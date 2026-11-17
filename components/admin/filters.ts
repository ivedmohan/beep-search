import type { JobFilters } from "@/lib/queries/admin";
/** Serialise job filters back into a query string (shared by server page and client form). */
export function filtersToQuery(f: JobFilters, page?: number): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.kind) p.set("kind", f.kind);
  if (f.fresher) p.set("fresher", f.fresher);
  if (f.regex) p.set("regex", f.regex);
  if (f.dups) p.set("dups", "1");
  if (f.hidden && f.hidden !== "any") p.set("hidden", f.hidden);
  if (f.closed && f.closed !== "open") p.set("closed", f.closed);
  const pg = page ?? f.page ?? 1;
  if (pg > 1) p.set("page", String(pg));
  const s = p.toString();
  return s ? `?${s}` : "";
}
