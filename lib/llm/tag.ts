import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { ROLES, CITIES, JOB_TYPES } from "@/lib/db/schema";
import { SYSTEM_PROMPT, TAG_MODEL, PRICE, userPrompt } from "./prompt";

const { jobs, llmCalls } = schema;

const TagSchema = z.object({
  id: z.number(),
  is_fresher: z.boolean(),
  job_type: z.enum(JOB_TYPES),
  role: z.enum(ROLES),
  city: z.enum(CITIES),
  confidence: z.number(),
  reason: z.string(),
});
const OutputSchema = z.object({ posts: z.array(TagSchema) });
export type Tag = z.infer<typeof TagSchema>;

export interface PendingJob {
  id: number;
  title: string;
  company: string;
  locationRaw: string;
  descriptionText: string;
}

export const BATCH_SIZE = 10;

let client: Anthropic | undefined;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return (client ??= new Anthropic());
}

export function costUsd(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  return (
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
    1e6
  );
}

/** One LLM call for a batch. Returns tags keyed by job id (missing ids = model skipped them). */
export async function classifyBatch(batch: PendingJob[], runId?: number | null): Promise<Map<number, Tag>> {
  const t0 = Date.now();
  const out = new Map<number, Tag>();
  try {
    const res = await getClient().messages.parse({
      model: TAG_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt(batch) }],
      output_config: { format: zodOutputFormat(OutputSchema), effort: "low" },
    });
    const u = res.usage;
    await db.insert(llmCalls).values({
      runId: runId ?? null,
      model: TAG_MODEL,
      postsCount: batch.length,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      costUsd: costUsd(u),
      latencyMs: Date.now() - t0,
      ok: res.stop_reason !== "refusal" && !!res.parsed_output,
      error: res.stop_reason === "refusal" ? "refusal" : res.parsed_output ? null : `no parsed output (stop_reason=${res.stop_reason})`,
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return out;
    const ids = new Set(batch.map((b) => b.id));
    for (const t of res.parsed_output.posts) if (ids.has(t.id)) out.set(t.id, t);
    return out;
  } catch (e) {
    await db.insert(llmCalls).values({
      runId: runId ?? null, model: TAG_MODEL, postsCount: batch.length, inputTokens: 0, outputTokens: 0,
      costUsd: 0, latencyMs: Date.now() - t0, ok: false, error: (e as Error).message.slice(0, 500),
    });
    throw e;
  }
}

async function persist(tags: Map<number, Tag>) {
  for (const t of tags.values()) {
    await db
      .update(jobs)
      .set({
        isFresher: t.is_fresher, jobType: t.job_type, role: t.role, city: t.city,
        llmConfidence: Math.max(0, Math.min(1, t.confidence)), llmModel: TAG_MODEL, llmReason: t.reason.slice(0, 300),
      })
      .where(eq(jobs.id, t.id));
  }
}

/**
 * Tag pending jobs in batches of BATCH_SIZE. On a failed/partial batch, retry once,
 * then fall back to single-post calls so no candidate is silently left untagged.
 */
export async function tagJobs(pending: PendingJob[], opts: { runId?: number | null; log?: (m: string) => void } = {}): Promise<number> {
  const log = opts.log ?? (() => {});
  let tagged = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    let tags = new Map<number, Tag>();
    try {
      tags = await classifyBatch(batch, opts.runId);
    } catch (e) {
      log(`llm batch failed (${(e as Error).message}); retrying once`);
      try {
        tags = await classifyBatch(batch, opts.runId);
      } catch (e2) {
        log(`llm batch retry failed: ${(e2 as Error).message}`);
      }
    }
    const missing = batch.filter((b) => !tags.has(b.id));
    for (const m of missing) {
      try {
        const single = await classifyBatch([m], opts.runId);
        for (const [k, v] of single) tags.set(k, v);
      } catch (e) {
        log(`llm single failed for job ${m.id}: ${(e as Error).message}`);
      }
    }
    await persist(tags);
    tagged += tags.size;
    const stillMissing = batch.length - tags.size;
    if (stillMissing) log(`${stillMissing} posts left untagged in batch starting at job ${batch[0].id}`);
  }
  return tagged;
}
