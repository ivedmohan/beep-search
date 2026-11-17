import { CITIES, JOB_TYPES, ROLES, SOURCE_KINDS, type City, type JobType, type Role, type SourceKind } from "@/lib/db/schema";

export const PAGE_SIZE = 24;
export const DAYS_OPTIONS = [7, 30, 90] as const;
export type DaysOption = (typeof DAYS_OPTIONS)[number];

/** Public job-board filters. Every field maps 1:1 to a URL search param. */
export type PublicFilters = {
  q: string;
  city: City | null;
  role: Role | null;
  type: JobType | null;
  kind: SourceKind | null;
  days: DaysOption | null;
  page: number;
  job: number | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parsePublicFilters(sp: SearchParams): PublicFilters {
  const page = Number.parseInt(first(sp.page), 10);
  const job = Number.parseInt(first(sp.job), 10);
  const days = Number.parseInt(first(sp.days), 10);
  return {
    q: first(sp.q).trim().slice(0, 120),
    city: oneOf(first(sp.city), CITIES),
    role: oneOf(first(sp.role), ROLES),
    type: oneOf(first(sp.type), JOB_TYPES),
    kind: oneOf(first(sp.kind), SOURCE_KINDS),
    days: (DAYS_OPTIONS as readonly number[]).includes(days) ? (days as DaysOption) : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    job: Number.isFinite(job) && job > 0 ? job : null,
  };
}

export function hasActiveFilters(f: PublicFilters): boolean {
  return Boolean(f.q || f.city || f.role || f.type || f.kind || f.days);
}

/** Build a board URL that keeps the current filters, with optional overrides (`page: 1` / `job: null` are omitted). */
export function buildHref(filters: PublicFilters, overrides: Partial<PublicFilters> = {}): string {
  const f = { ...filters, ...overrides };
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.city) p.set("city", f.city);
  if (f.role) p.set("role", f.role);
  if (f.type) p.set("type", f.type);
  if (f.kind) p.set("kind", f.kind);
  if (f.days) p.set("days", String(f.days));
  if (f.page > 1) p.set("page", String(f.page));
  if (f.job) p.set("job", String(f.job));
  const s = p.toString();
  return s ? `/?${s}` : "/";
}
