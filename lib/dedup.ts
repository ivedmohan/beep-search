import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

const { jobs, sources } = schema;

const COMPANY_NOISE = /\b(pvt\.?|private|ltd\.?|limited|inc\.?|llc|llp|technologies|technology|tech|labs|india|software|solutions|services|group|co\.?|corp\.?|corporation)\b/g;
const TITLE_NOISE = /\((remote|hybrid|on[- ]?site|india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|gurgaon|gurugram|noida)[^)]*\)|\s*[-–|:]\s*(remote|india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|gurgaon|gurugram|noida)\s*$/gi;

export function normalizeCompany(s: string): string {
  return s.toLowerCase().replace(COMPANY_NOISE, " ").replace(/[^a-z0-9]+/g, " ").trim();
}
export function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(TITLE_NOISE, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
export function normalizeLocation(s: string): string {
  return s.toLowerCase().replace(/\((remote|hybrid|on[- ]?site|onsite)\)/g, " ").replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim();
}
/** Key = company | title | city (LLM city when tagged, else the normalized raw location). */
export function dedupKey(company: string, title: string, city: string | null | undefined, locationRaw = ""): string {
  return `${normalizeCompany(company)}|${normalizeTitle(title)}|${city ?? normalizeLocation(locationRaw) ?? "?"}`;
}

/**
 * Recompute dedup keys and canonical links across all open posts.
 * Canonical = direct ATS (non-aggregator) first, then earliest first_seen_at, then lowest id.
 * Rows that are not canonical get canonical_job_id set; canonical rows get NULL.
 */
export async function runDedup(): Promise<{ groups: number; duplicates: number }> {
  const rows = await db
    .select({
      id: jobs.id,
      company: jobs.company,
      title: jobs.title,
      city: jobs.city,
      locationRaw: jobs.locationRaw,
      applyUrl: jobs.applyUrl,
      firstSeenAt: jobs.firstSeenAt,
      kind: sources.kind,
    })
    .from(jobs)
    .innerJoin(sources, eq(sources.id, jobs.sourceId))
    .where(isNull(jobs.closedAt));

  // Union-find over two keys: normalized (company|title|city) and exact apply URL.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const r of rows) parent.set(r.id, r.id);
  const byKey = new Map<string, number>();
  const byUrl = new Map<string, number>();
  const keyOf = new Map<number, string>();
  for (const r of rows) {
    const k = dedupKey(r.company, r.title, r.city, r.locationRaw);
    keyOf.set(r.id, k);
    const prev = byKey.get(k);
    if (prev !== undefined) union(r.id, prev); else byKey.set(k, r.id);
    const u = r.applyUrl.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
    const pu = byUrl.get(u);
    if (pu !== undefined) union(r.id, pu); else byUrl.set(u, r.id);
  }
  const groups = new Map<number, typeof rows>();
  for (const r of rows) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(r);
  }
  let duplicates = 0;
  for (const members of groups.values()) {
    members.sort((a, b) => {
      const ka = a.kind === "smartrecruiters" ? 1 : 0; // direct ATS boards tie; aggregators (none yet) would rank later
      const kb = b.kind === "smartrecruiters" ? 1 : 0;
      if (ka !== kb) return ka - kb;
      const t = a.firstSeenAt.getTime() - b.firstSeenAt.getTime();
      return t !== 0 ? t : a.id - b.id;
    });
    const canonical = members[0];
    for (const m of members) {
      const isCanon = m.id === canonical.id;
      if (!isCanon) duplicates++;
      await db
        .update(jobs)
        .set({ dedupKey: keyOf.get(m.id), canonicalJobId: isCanon ? null : canonical.id })
        .where(and(eq(jobs.id, m.id), sql`(dedup_key is distinct from ${keyOf.get(m.id)} or canonical_job_id is distinct from ${isCanon ? null : canonical.id})`));
    }
  }
  return { groups: groups.size, duplicates };
}
