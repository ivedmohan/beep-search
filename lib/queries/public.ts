import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { City, Job, JobType, Role, SourceKind } from "@/lib/db/schema";
import { PAGE_SIZE, type PublicFilters } from "@/components/jobs/filters";

const { jobs, sources } = schema;

/** Canonical, open, admin-visible, LLM-tagged fresher posts only. Shared by every public query. */
const publiclyVisible = and(
  isNull(jobs.closedAt),
  eq(jobs.hiddenByAdmin, false),
  eq(jobs.isFresher, true),
  isNull(jobs.canonicalJobId),
);

export type PublicJobListRow = {
  id: number;
  title: string;
  company: string;
  locationRaw: string;
  city: City | null;
  role: Role | null;
  jobType: JobType | null;
  postedAt: Date | null;
  firstSeenAt: Date;
  sourceKind: SourceKind;
};

export type PublicJobList = {
  items: PublicJobListRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export type PublicJobDetail = Pick<
  Job,
  | "id"
  | "title"
  | "company"
  | "locationRaw"
  | "city"
  | "role"
  | "jobType"
  | "llmReason"
  | "llmConfidence"
  | "descriptionText"
  | "applyUrl"
  | "postedAt"
  | "firstSeenAt"
> & {
  sourceKind: SourceKind;
  sourceToken: string;
  sourceDisplayName: string;
};

export type PublicStats = {
  openJobs: number;
  companies: number;
  lastRunAt: Date | null;
};

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function filterConditions(f: PublicFilters) {
  const pattern = f.q ? `%${escapeLike(f.q)}%` : null;
  return and(
    publiclyVisible,
    pattern ? or(ilike(jobs.title, pattern), ilike(jobs.company, pattern)) : undefined,
    f.city ? eq(jobs.city, f.city) : undefined,
    f.role ? eq(jobs.role, f.role) : undefined,
    f.type ? eq(jobs.jobType, f.type) : undefined,
    f.kind ? eq(sources.kind, f.kind) : undefined,
    f.days
      ? sql`coalesce(${jobs.postedAt}, ${jobs.firstSeenAt}) >= now() - interval '1 day' * ${f.days}`
      : undefined,
  );
}

/** One round trip: page rows plus the filtered total via a window function. */
export async function listPublicJobs(f: PublicFilters): Promise<PublicJobList> {
  const offset = (f.page - 1) * PAGE_SIZE;
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      locationRaw: jobs.locationRaw,
      city: jobs.city,
      role: jobs.role,
      jobType: jobs.jobType,
      postedAt: jobs.postedAt,
      firstSeenAt: jobs.firstSeenAt,
      sourceKind: sources.kind,
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(jobs)
    .innerJoin(sources, eq(sources.id, jobs.sourceId))
    .where(filterConditions(f))
    .orderBy(sql`${jobs.postedAt} desc nulls last`, desc(jobs.firstSeenAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const total = rows[0]?.total ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      locationRaw: row.locationRaw,
      city: row.city,
      role: row.role,
      jobType: row.jobType,
      postedAt: row.postedAt,
      firstSeenAt: row.firstSeenAt,
      sourceKind: row.sourceKind,
    })),
    total,
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}

/** Selected job; applies the same visibility rules so hidden/closed posts cannot be opened via `?job=`. */
export async function getPublicJob(id: number): Promise<PublicJobDetail | null> {
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      locationRaw: jobs.locationRaw,
      city: jobs.city,
      role: jobs.role,
      jobType: jobs.jobType,
      llmReason: jobs.llmReason,
      llmConfidence: jobs.llmConfidence,
      descriptionText: jobs.descriptionText,
      applyUrl: jobs.applyUrl,
      postedAt: jobs.postedAt,
      firstSeenAt: jobs.firstSeenAt,
      sourceKind: sources.kind,
      sourceToken: sources.token,
      sourceDisplayName: sources.displayName,
    })
    .from(jobs)
    .innerJoin(sources, eq(sources.id, jobs.sourceId))
    .where(and(publiclyVisible, eq(jobs.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

/** Footer aggregate: open fresher posts, distinct companies, and the latest source run (one query). */
export async function getPublicStats(): Promise<PublicStats> {
  const [row] = await db
    .select({
      openJobs: sql<number>`count(*)`.mapWith(Number),
      companies: sql<number>`count(distinct ${jobs.company})`.mapWith(Number),
      lastRunAt: sql<Date | null>`(select max(${sources.lastRunAt}) from ${sources})`.mapWith((v: unknown) =>
        v == null ? null : new Date(v as string | Date),
      ),
    })
    .from(jobs)
    .where(publiclyVisible);
  return row ?? { openJobs: 0, companies: 0, lastRunAt: null };
}
