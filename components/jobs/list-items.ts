import type { PublicJobListRow } from "@/lib/queries/public";
import { buildHref, type PublicFilters } from "./filters";
import type { JobListItem } from "./JobCard";
import { CITY_LABELS, companyInitial, formatPostedAgo, JOB_TYPE_LABELS, KIND_LABELS, ROLE_LABELS } from "./labels";

/** Server-side mapping from a DB row to the plain strings the client list renders. */
export function toListItem(row: PublicJobListRow, filters: PublicFilters, now: Date): JobListItem {
  const chips: string[] = [];
  if (row.jobType && row.jobType !== "unknown") chips.push(JOB_TYPE_LABELS[row.jobType]);
  if (row.city) chips.push(CITY_LABELS[row.city]);
  if (row.role) chips.push(ROLE_LABELS[row.role]);
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    initial: companyInitial(row.company),
    location: row.locationRaw.trim(),
    chips,
    postedLabel: formatPostedAgo(row.postedAt ?? row.firstSeenAt, now),
    sourceLabel: KIND_LABELS[row.sourceKind],
    href: buildHref(filters, { job: row.id }),
  };
}
