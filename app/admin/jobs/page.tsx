import Link from "next/link";
import { JOBS_PAGE_SIZE, listJobs, parseJobFilters } from "@/lib/queries/admin";
import { JobsFilters } from "@/components/admin/JobsFilters";
import { filtersToQuery } from "@/components/admin/filters";
import { JobsTable } from "@/components/admin/JobsTable";
import { PageHeader, fmtInt } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminJobsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const filters = parseJobFilters(sp);
  const { rows, total, page, pages } = await listJobs(filters);
  const from = total === 0 ? 0 : (page - 1) * JOBS_PAGE_SIZE + 1;
  const to = Math.min(total, page * JOBS_PAGE_SIZE);
  const key = filtersToQuery(filters, page);

  const pager = (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">
        {fmtInt(from)}–{fmtInt(to)} of {fmtInt(total)}
      </span>
      {page > 1 ? (
        <Link href={`/admin/jobs${filtersToQuery(filters, page - 1)}`} className="btn-ghost px-3 py-1">
          ‹ Prev
        </Link>
      ) : (
        <span className="btn-ghost px-3 py-1 opacity-50">‹ Prev</span>
      )}
      <span className="tabular-nums">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={`/admin/jobs${filtersToQuery(filters, page + 1)}`} className="btn-ghost px-3 py-1">
          Next ›
        </Link>
      ) : (
        <span className="btn-ghost px-3 py-1 opacity-50">Next ›</span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Jobs" subtitle={`${fmtInt(total)} matching · ${JOBS_PAGE_SIZE} per page`}>
        {pager}
      </PageHeader>
      <JobsFilters key={key} initial={filters} />
      <JobsTable key={key} rows={rows} />
      <div className="flex justify-end">{pager}</div>
    </div>
  );
}
