import { and, asc, desc, eq, getTableColumns, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { SOURCE_KINDS, type City, type JobType, type Role, type SourceKind } from "@/lib/db/schema";

const { sources, jobs, ingestRuns, llmCalls, reviews } = schema;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface AdminSourceRow {
  id: number;
  kind: SourceKind;
  token: string;
  displayName: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastCount: number | null;
  openJobs: number;
  openFresher: number;
}

export async function listSources(): Promise<AdminSourceRow[]> {
  const counts = db
    .select({
      sourceId: jobs.sourceId,
      open: sql<number>`count(*)::int`.as("open"),
      openFresher:
        sql<number>`count(*) filter (where ${jobs.isFresher} = true and ${jobs.canonicalJobId} is null and ${jobs.hiddenByAdmin} = false)::int`.as(
          "open_fresher",
        ),
    })
    .from(jobs)
    .where(isNull(jobs.closedAt))
    .groupBy(jobs.sourceId)
    .as("c");

  const rows = await db
    .select({
      ...getTableColumns(sources),
      openJobs: sql<number>`coalesce(${counts.open}, 0)::int`,
      openFresher: sql<number>`coalesce(${counts.openFresher}, 0)::int`,
    })
    .from(sources)
    .leftJoin(counts, eq(counts.sourceId, sources.id))
    .orderBy(desc(sources.enabled), asc(sources.kind), asc(sources.displayName));

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastRunAt: iso(r.lastRunAt),
  }));
}

export async function getSource(id: number) {
  const [row] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  return row ?? null;
}

/** Lever tokens are case-sensitive; Greenhouse/Ashby/SmartRecruiters are not. */
export function normalizeToken(kind: SourceKind, token: string): string {
  const t = token.trim();
  return kind === "lever" ? t : t.toLowerCase();
}

export async function findSourceByKindToken(kind: SourceKind, token: string) {
  const [row] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.kind, kind), eq(sources.token, token)))
    .limit(1);
  return row ?? null;
}

export async function createSource(input: { kind: SourceKind; token: string; displayName: string }) {
  const [row] = await db
    .insert(sources)
    .values({ kind: input.kind, token: input.token, displayName: input.displayName, enabled: true })
    .returning();
  return row;
}

export async function setSourceEnabled(id: number, enabled: boolean) {
  const [row] = await db.update(sources).set({ enabled }).where(eq(sources.id, id)).returning();
  return row ?? null;
}

/** Soft delete: disable and close every open job for that source. */
export async function softDeleteSource(id: number): Promise<{ source: schema.Source | null; closed: number }> {
  const [source] = await db.update(sources).set({ enabled: false }).where(eq(sources.id, id)).returning();
  if (!source) return { source: null, closed: 0 };
  const closedRows = await db
    .update(jobs)
    .set({ closedAt: new Date() })
    .where(and(eq(jobs.sourceId, id), isNull(jobs.closedAt)))
    .returning({ id: jobs.id });
  return { source, closed: closedRows.length };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const JOBS_PAGE_SIZE = 50;

export interface JobFilters {
  q?: string;
  kind?: SourceKind;
  fresher?: "yes" | "no" | "untagged";
  regex?: "yes" | "no";
  dups?: boolean;
  hidden?: "any" | "yes" | "no";
  closed?: "open" | "closed" | "all";
  page?: number;
}

export interface AdminJobRow {
  id: number;
  title: string;
  company: string;
  locationRaw: string;
  city: City | null;
  role: Role | null;
  jobType: JobType | null;
  isFresher: boolean | null;
  llmConfidence: number | null;
  llmModel: string | null;
  llmReason: string | null;
  regexCandidate: boolean;
  regexSignals: string | null;
  canonicalJobId: number | null;
  applyUrl: string;
  closedAt: string | null;
  hiddenByAdmin: boolean;
  firstSeenAt: string;
  sourceId: number;
  sourceKind: SourceKind;
  sourceToken: string;
}

const jobRowSelect = {
  id: jobs.id,
  title: jobs.title,
  company: jobs.company,
  locationRaw: jobs.locationRaw,
  city: jobs.city,
  role: jobs.role,
  jobType: jobs.jobType,
  isFresher: jobs.isFresher,
  llmConfidence: jobs.llmConfidence,
  llmModel: jobs.llmModel,
  llmReason: jobs.llmReason,
  regexCandidate: jobs.regexCandidate,
  regexSignals: jobs.regexSignals,
  canonicalJobId: jobs.canonicalJobId,
  applyUrl: jobs.applyUrl,
  closedAt: jobs.closedAt,
  hiddenByAdmin: jobs.hiddenByAdmin,
  firstSeenAt: jobs.firstSeenAt,
  sourceId: jobs.sourceId,
  sourceKind: sources.kind,
  sourceToken: sources.token,
};

const jobQuery = () => db.select(jobRowSelect).from(jobs).innerJoin(sources, eq(sources.id, jobs.sourceId));
type RawJobRow = Awaited<ReturnType<typeof jobQuery>>[number];

function serializeJob(r: RawJobRow): AdminJobRow {
  return { ...r, closedAt: iso(r.closedAt), firstSeenAt: r.firstSeenAt.toISOString() };
}

export function parseJobFilters(sp: Record<string, string | string[] | undefined>): JobFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const kind = one("kind");
  const fresher = one("fresher");
  const regex = one("regex");
  const hidden = one("hidden");
  const closed = one("closed");
  const page = Number.parseInt(one("page") || "1", 10);
  return {
    q: one("q").trim() || undefined,
    kind: (SOURCE_KINDS as readonly string[]).includes(kind) ? (kind as SourceKind) : undefined,
    fresher: fresher === "yes" || fresher === "no" || fresher === "untagged" ? fresher : undefined,
    regex: regex === "yes" || regex === "no" ? regex : undefined,
    dups: one("dups") === "1",
    hidden: hidden === "yes" || hidden === "no" ? hidden : "any",
    closed: closed === "closed" || closed === "all" ? closed : "open",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function jobWhere(f: JobFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.q) {
    const idMatch = /^#(\d+)$/.exec(f.q);
    if (idMatch) conds.push(eq(jobs.id, Number(idMatch[1])));
    else {
      const pat = `%${f.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      conds.push(or(ilike(jobs.title, pat), ilike(jobs.company, pat), ilike(jobs.locationRaw, pat))!);
    }
  }
  if (f.kind) conds.push(eq(sources.kind, f.kind));
  if (f.fresher === "yes") conds.push(eq(jobs.isFresher, true));
  else if (f.fresher === "no") conds.push(eq(jobs.isFresher, false));
  else if (f.fresher === "untagged") conds.push(isNull(jobs.isFresher));
  if (f.regex === "yes") conds.push(eq(jobs.regexCandidate, true));
  else if (f.regex === "no") conds.push(eq(jobs.regexCandidate, false));
  if (f.dups) conds.push(isNotNull(jobs.canonicalJobId));
  if (f.hidden === "yes") conds.push(eq(jobs.hiddenByAdmin, true));
  else if (f.hidden === "no") conds.push(eq(jobs.hiddenByAdmin, false));
  if (f.closed === "open") conds.push(isNull(jobs.closedAt));
  else if (f.closed === "closed") conds.push(isNotNull(jobs.closedAt));
  return conds.length ? and(...conds) : undefined;
}

export async function listJobs(f: JobFilters): Promise<{ rows: AdminJobRow[]; total: number; page: number; pages: number }> {
  const where = jobWhere(f);
  const page = f.page ?? 1;
  const [[{ total }], rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(jobs)
      .innerJoin(sources, eq(sources.id, jobs.sourceId))
      .where(where),
    jobQuery()
      .where(where)
      .orderBy(desc(jobs.firstSeenAt), desc(jobs.id))
      .limit(JOBS_PAGE_SIZE)
      .offset((page - 1) * JOBS_PAGE_SIZE),
  ]);
  return { rows: rows.map(serializeJob), total, page, pages: Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE)) };
}

export async function getJobRow(id: number): Promise<AdminJobRow | null> {
  const [row] = await jobQuery().where(eq(jobs.id, id)).limit(1);
  return row ? serializeJob(row) : null;
}

export async function updateJob(id: number, patch: Partial<schema.NewJob>) {
  const [row] = await db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Review sample (stable, seeded) + reviews
// ---------------------------------------------------------------------------

export const REVIEW_SEED = "beep-review-seed";
export const REVIEW_SAMPLE_SIZE = 50;

export interface ReviewSampleRow {
  id: number;
  title: string;
  company: string;
  locationRaw: string;
  descriptionText: string;
  applyUrl: string;
  sourceKind: SourceKind;
  role: Role | null;
  city: City | null;
  jobType: JobType | null;
  isFresher: boolean | null;
  llmConfidence: number | null;
  llmReason: string | null;
  llmModel: string | null;
  review: ReviewValue | null;
}

export interface ReviewValue {
  jobId: number;
  roleCorrect: boolean | null;
  cityCorrect: boolean | null;
  fresherCorrect: boolean | null;
  correctedRole: Role | null;
  correctedCity: City | null;
  correctedFresher: boolean | null;
  note: string | null;
  updatedAt: string | null;
}

const reviewSampleWhere = () =>
  and(isNull(jobs.closedAt), eq(jobs.isFresher, true), isNull(jobs.canonicalJobId), or(isNull(jobs.llmModel), ne(jobs.llmModel, "regex-veto")));

export async function getReviewSample(): Promise<ReviewSampleRow[]> {
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      locationRaw: jobs.locationRaw,
      descriptionText: jobs.descriptionText,
      applyUrl: jobs.applyUrl,
      sourceKind: sources.kind,
      role: jobs.role,
      city: jobs.city,
      jobType: jobs.jobType,
      isFresher: jobs.isFresher,
      llmConfidence: jobs.llmConfidence,
      llmReason: jobs.llmReason,
      llmModel: jobs.llmModel,
      rJobId: reviews.jobId,
      roleCorrect: reviews.roleCorrect,
      cityCorrect: reviews.cityCorrect,
      fresherCorrect: reviews.fresherCorrect,
      correctedRole: reviews.correctedRole,
      correctedCity: reviews.correctedCity,
      correctedFresher: reviews.correctedFresher,
      note: reviews.note,
      updatedAt: reviews.updatedAt,
    })
    .from(jobs)
    .innerJoin(sources, eq(sources.id, jobs.sourceId))
    .leftJoin(reviews, eq(reviews.jobId, jobs.id))
    .where(reviewSampleWhere())
    .orderBy(sql`md5(${jobs.id}::text || ${REVIEW_SEED})`)
    .limit(REVIEW_SAMPLE_SIZE);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    locationRaw: r.locationRaw,
    descriptionText: r.descriptionText,
    applyUrl: r.applyUrl,
    sourceKind: r.sourceKind,
    role: r.role,
    city: r.city,
    jobType: r.jobType,
    isFresher: r.isFresher,
    llmConfidence: r.llmConfidence,
    llmReason: r.llmReason,
    llmModel: r.llmModel,
    review:
      r.rJobId == null
        ? null
        : {
            jobId: r.rJobId,
            roleCorrect: r.roleCorrect,
            cityCorrect: r.cityCorrect,
            fresherCorrect: r.fresherCorrect,
            correctedRole: r.correctedRole,
            correctedCity: r.correctedCity,
            correctedFresher: r.correctedFresher,
            note: r.note,
            updatedAt: iso(r.updatedAt),
          },
  }));
}

export async function upsertReview(input: Omit<ReviewValue, "updatedAt">): Promise<ReviewValue> {
  const now = new Date();
  const values = {
    jobId: input.jobId,
    roleCorrect: input.roleCorrect,
    cityCorrect: input.cityCorrect,
    fresherCorrect: input.fresherCorrect,
    correctedRole: input.correctedRole,
    correctedCity: input.correctedCity,
    correctedFresher: input.correctedFresher,
    note: input.note,
    updatedAt: now,
  };
  const [row] = await db
    .insert(reviews)
    .values(values)
    .onConflictDoUpdate({ target: reviews.jobId, set: { ...values, jobId: undefined } })
    .returning();
  return {
    jobId: row.jobId,
    roleCorrect: row.roleCorrect,
    cityCorrect: row.cityCorrect,
    fresherCorrect: row.fresherCorrect,
    correctedRole: row.correctedRole,
    correctedCity: row.correctedCity,
    correctedFresher: row.correctedFresher,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface AdminStats {
  jobs: { totalOpen: number; openFresher: number; duplicates: number; untagged: number; regexVeto: number };
  sources: { total: number; enabled: number; erroring: number };
  llm: {
    calls: number;
    failedCalls: number;
    totalCostUsd: number;
    postsTagged: number;
    costPer1k: number | null;
    avgTokensPerPost: number | null;
    cacheHitRate: number | null;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  recentRuns: {
    id: number;
    sourceId: number | null;
    sourceLabel: string | null;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    trigger: string;
    fetched: number;
    indiaMatched: number;
    inserted: number;
    updated: number;
    closed: number;
    llmTagged: number;
    error: string | null;
  }[];
  perKind: { kind: SourceKind; sources: number; openJobs: number; openFresher: number }[];
  byRole: { role: string; count: number }[];
  byCity: { city: string; count: number }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const canonicalFresher = and(isNull(jobs.closedAt), eq(jobs.isFresher, true), isNull(jobs.canonicalJobId), eq(jobs.hiddenByAdmin, false));

  const [[j], [s], [l], runs, perKind, byRole, byCity] = await Promise.all([
    db
      .select({
        totalOpen: sql<number>`count(*) filter (where ${jobs.closedAt} is null)::int`,
        openFresher:
          sql<number>`count(*) filter (where ${jobs.closedAt} is null and ${jobs.isFresher} = true and ${jobs.canonicalJobId} is null and ${jobs.hiddenByAdmin} = false)::int`,
        duplicates: sql<number>`count(*) filter (where ${jobs.closedAt} is null and ${jobs.canonicalJobId} is not null)::int`,
        untagged: sql<number>`count(*) filter (where ${jobs.closedAt} is null and ${jobs.llmModel} is null)::int`,
        regexVeto: sql<number>`count(*) filter (where ${jobs.closedAt} is null and ${jobs.llmModel} = 'regex-veto')::int`,
      })
      .from(jobs),
    db
      .select({
        total: sql<number>`count(*)::int`,
        enabled: sql<number>`count(*) filter (where ${sources.enabled})::int`,
        erroring: sql<number>`count(*) filter (where ${sources.enabled} and ${sources.lastStatus} = 'error')::int`,
      })
      .from(sources),
    db
      .select({
        calls: sql<number>`count(*)::int`,
        failedCalls: sql<number>`count(*) filter (where not ${llmCalls.ok})::int`,
        totalCostUsd: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)::float8`,
        postsTagged: sql<number>`coalesce(sum(${llmCalls.postsCount}) filter (where ${llmCalls.ok}), 0)::int`,
        inputTokens: sql<number>`coalesce(sum(${llmCalls.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${llmCalls.outputTokens}), 0)::int`,
        cacheReadTokens: sql<number>`coalesce(sum(${llmCalls.cacheReadTokens}), 0)::int`,
        cacheWriteTokens: sql<number>`coalesce(sum(${llmCalls.cacheWriteTokens}), 0)::int`,
      })
      .from(llmCalls),
    db
      .select({
        id: ingestRuns.id,
        sourceId: ingestRuns.sourceId,
        sourceKind: sources.kind,
        sourceToken: sources.token,
        startedAt: ingestRuns.startedAt,
        finishedAt: ingestRuns.finishedAt,
        status: ingestRuns.status,
        trigger: ingestRuns.trigger,
        fetched: ingestRuns.fetched,
        indiaMatched: ingestRuns.indiaMatched,
        inserted: ingestRuns.inserted,
        updated: ingestRuns.updated,
        closed: ingestRuns.closed,
        llmTagged: ingestRuns.llmTagged,
        error: ingestRuns.error,
      })
      .from(ingestRuns)
      .leftJoin(sources, eq(sources.id, ingestRuns.sourceId))
      .orderBy(desc(ingestRuns.startedAt), desc(ingestRuns.id))
      .limit(15),
    db
      .select({
        kind: sources.kind,
        sources: sql<number>`count(distinct ${sources.id})::int`,
        openJobs: sql<number>`count(${jobs.id}) filter (where ${jobs.closedAt} is null)::int`,
        openFresher: sql<number>`count(${jobs.id}) filter (where ${canonicalFresher})::int`,
      })
      .from(sources)
      .leftJoin(jobs, eq(jobs.sourceId, sources.id))
      .groupBy(sources.kind)
      .orderBy(asc(sources.kind)),
    db
      .select({ role: sql<string>`coalesce(${jobs.role}, '(untagged)')`, count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(canonicalFresher)
      .groupBy(jobs.role)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ city: sql<string>`coalesce(${jobs.city}, '(untagged)')`, count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(canonicalFresher)
      .groupBy(jobs.city)
      .orderBy(desc(sql`count(*)`)),
  ]);

  const totalTokens = l.inputTokens + l.outputTokens + l.cacheReadTokens + l.cacheWriteTokens;
  const promptTokens = l.inputTokens + l.cacheReadTokens + l.cacheWriteTokens;
  return {
    jobs: j,
    sources: s,
    llm: {
      ...l,
      costPer1k: l.postsTagged > 0 ? (l.totalCostUsd / l.postsTagged) * 1000 : null,
      avgTokensPerPost: l.postsTagged > 0 ? totalTokens / l.postsTagged : null,
      cacheHitRate: promptTokens > 0 ? l.cacheReadTokens / promptTokens : null,
    },
    recentRuns: runs.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      sourceLabel: r.sourceKind ? `${r.sourceKind}/${r.sourceToken}` : null,
      startedAt: r.startedAt.toISOString(),
      finishedAt: iso(r.finishedAt),
      status: r.status,
      trigger: r.trigger,
      fetched: r.fetched,
      indiaMatched: r.indiaMatched,
      inserted: r.inserted,
      updated: r.updated,
      closed: r.closed,
      llmTagged: r.llmTagged,
      error: r.error,
    })),
    perKind,
    byRole,
    byCity,
  };
}

