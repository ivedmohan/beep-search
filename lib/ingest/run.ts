import { and, eq, isNull, lt, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { adapters } from "@/lib/sources";
import { isIndiaPost } from "@/lib/filter/india";
import { regexGate } from "@/lib/filter/regex";
import { tagJobs } from "@/lib/llm/tag";
import type { Source } from "@/lib/db/schema";

const { jobs, sources, ingestRuns } = schema;

export interface IngestOptions {
  trigger?: "cron" | "manual";
  /** Skip the LLM step (used for dry runs / discovery). */
  skipLlm?: boolean;
  /** Max posts to tag in this invocation (keeps route handlers under the time limit). */
  llmLimit?: number;
  log?: (msg: string) => void;
}

export interface IngestSummary {
  runId: number;
  sourceId: number;
  status: "ok" | "error";
  fetched: number;
  indiaMatched: number;
  inserted: number;
  updated: number;
  closed: number;
  llmTagged: number;
  error?: string;
}

/** Ingest one source end to end: fetch -> India filter -> upsert -> soft-close -> regex -> LLM. */
export async function ingestSource(source: Source, opts: IngestOptions = {}): Promise<IngestSummary> {
  const log = opts.log ?? (() => {});
  const startedAt = new Date();
  const [run] = await db
    .insert(ingestRuns)
    .values({ sourceId: source.id, trigger: opts.trigger ?? "manual", startedAt })
    .returning({ id: ingestRuns.id });
  const summary: IngestSummary = {
    runId: run.id, sourceId: source.id, status: "ok",
    fetched: 0, indiaMatched: 0, inserted: 0, updated: 0, closed: 0, llmTagged: 0,
  };

  const finish = async () => {
    await db
      .update(ingestRuns)
      .set({
        finishedAt: new Date(), status: summary.status, error: summary.error,
        fetched: summary.fetched, indiaMatched: summary.indiaMatched, inserted: summary.inserted,
        updated: summary.updated, closed: summary.closed, llmTagged: summary.llmTagged,
      })
      .where(eq(ingestRuns.id, run.id));
    await db
      .update(sources)
      .set({
        lastRunAt: new Date(), lastStatus: summary.status, lastError: summary.error ?? null,
        lastCount: summary.status === "ok" ? summary.indiaMatched : source.lastCount,
      })
      .where(eq(sources.id, source.id));
    return summary;
  };

  const adapter = adapters[source.kind];
  const res = await adapter.fetchBoard(source.token);
  if (!res.ok) {
    summary.status = "error";
    summary.error = res.error;
    log(`[${source.kind}/${source.token}] fetch failed: ${res.error}`);
    return finish(); // IMPORTANT: never close jobs when the fetch failed
  }
  summary.fetched = res.posts.length;
  const india = res.posts.filter(isIndiaPost);
  summary.indiaMatched = india.length;
  log(`[${source.kind}/${source.token}] fetched ${res.posts.length}, india ${india.length}`);

  // Upsert in chunks (one round-trip per 200 rows; Neon latency makes per-row upserts slow).
  const now = new Date();
  const rows = india.map((p) => {
    const verdict = regexGate(p);
    return {
      sourceId: source.id,
      externalId: p.externalId,
      title: p.title || "(untitled)",
      company: p.company || res.company || source.displayName,
      locationRaw: p.locationRaw,
      descriptionText: p.description.slice(0, 20_000),
      applyUrl: p.applyUrl,
      postedAt: p.postedAt ?? null,
      lastSeenAt: now,
      closedAt: null,
      regexCandidate: verdict.candidate,
      regexSignals: verdict.signals.join(","),
      raw: p.raw as object,
    };
  });
  // De-dupe by externalId within the batch (some boards list a job twice).
  const byExt = new Map(rows.map((r) => [r.externalId, r]));
  const unique = [...byExt.values()];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const r = await db
      .insert(jobs)
      .values(chunk)
      .onConflictDoUpdate({
        target: [jobs.sourceId, jobs.externalId],
        set: {
          title: sql`excluded.title`, company: sql`excluded.company`, locationRaw: sql`excluded.location_raw`,
          descriptionText: sql`excluded.description_text`, applyUrl: sql`excluded.apply_url`, postedAt: sql`excluded.posted_at`,
          lastSeenAt: now, closedAt: null, regexCandidate: sql`excluded.regex_candidate`, regexSignals: sql`excluded.regex_signals`,
          raw: sql`excluded.raw`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    for (const x of r) if (x.inserted) summary.inserted++; else summary.updated++;
  }

  // Soft close: open jobs from this source not seen in this (successful) run.
  const closedRows = await db
    .update(jobs)
    .set({ closedAt: now })
    .where(and(eq(jobs.sourceId, source.id), isNull(jobs.closedAt), lt(jobs.lastSeenAt, startedAt)))
    .returning({ id: jobs.id });
  summary.closed = closedRows.length;

  // LLM tagging for candidates not yet tagged.
  if (!opts.skipLlm) {
    const pending = await db
      .select({ id: jobs.id, title: jobs.title, company: jobs.company, locationRaw: jobs.locationRaw, descriptionText: jobs.descriptionText })
      .from(jobs)
      .where(and(eq(jobs.sourceId, source.id), isNull(jobs.closedAt), eq(jobs.regexCandidate, true), isNull(jobs.llmModel)))
      .limit(opts.llmLimit ?? 500);
    if (pending.length) {
      try {
        const n = await tagJobs(pending, { runId: run.id, log });
        summary.llmTagged = n;
      } catch (e) {
        summary.status = "error";
        summary.error = `llm: ${(e as Error).message}`;
        log(`[${source.kind}/${source.token}] llm failed: ${summary.error}`);
      }
    }
    // Non-candidates are definitively not fresher (regex veto) – record that without an LLM call.
    await db
      .update(jobs)
      .set({ isFresher: false, llmModel: "regex-veto", llmReason: "senior marker in title/description, no fresher signal" })
      .where(and(eq(jobs.sourceId, source.id), eq(jobs.regexCandidate, false), isNull(jobs.llmModel)));
  }
  return finish();
}

export async function ingestAll(opts: IngestOptions & { sourceIds?: number[] } = {}): Promise<IngestSummary[]> {
  const where = opts.sourceIds?.length ? and(eq(sources.enabled, true), inArray(sources.id, opts.sourceIds)) : eq(sources.enabled, true);
  const list = await db.select().from(sources).where(where).orderBy(sources.id);
  const out: IngestSummary[] = [];
  const conc = 4;
  let i = 0;
  await Promise.all(
    Array.from({ length: conc }, async () => {
      while (i < list.length) {
        const s = list[i++];
        out.push(await ingestSource(s, opts));
      }
    }),
  );
  return out;
}
