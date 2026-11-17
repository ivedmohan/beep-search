import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { FilterBar } from "@/components/jobs/FilterBar";
import { FooterBand } from "@/components/jobs/FooterBand";
import { JobDetail } from "@/components/jobs/JobDetail";
import { JobList } from "@/components/jobs/JobList";
import { Pagination } from "@/components/jobs/Pagination";
import { ScrollToDetail } from "@/components/jobs/ScrollToDetail";
import { hasActiveFilters, parsePublicFilters } from "@/components/jobs/filters";
import { toListItem } from "@/components/jobs/list-items";
import { getPublicJob, getPublicStats, listPublicJobs } from "@/lib/queries/public";

export const dynamic = "force-dynamic";

const DETAIL_ID = "job";

export default async function Page(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const filters = parsePublicFilters(sp);
  const now = new Date();

  // One list query + one stats query; the selected-job query runs in parallel when `?job=` is explicit.
  const [list, stats, explicitJob] = await Promise.all([
    listPublicJobs(filters),
    getPublicStats(),
    filters.job ? getPublicJob(filters.job) : Promise.resolve(null),
  ]);
  // Default selection = first card on the page. A dead `?job=` link shows a message rather than silently swapping jobs.
  const firstId = list.items[0]?.id ?? null;
  const selected = explicitJob ?? (filters.job == null && firstId != null ? await getPublicJob(firstId) : null);
  const selectedId = selected?.id ?? null;
  const items = list.items.map((row) => toListItem(row, filters, now));
  const from = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const to = Math.min(list.total, list.page * list.pageSize);
  const showDetailFirst = Boolean(explicitJob);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav active="jobs" />

      <div className="border-b border-hairline">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <FilterBar filters={filters} />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
        <section
          aria-label="Job list"
          className={`${showDetailFirst ? "order-2 lg:order-none" : "order-1"} lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1`}
        >
          {list.total === 0 ? (
            <EmptyList filtered={hasActiveFilters(filters)} />
          ) : (
            <>
              <JobList items={items} selectedId={selectedId} total={list.total} rangeLabel={`showing ${from}–${to}`} />
              <Pagination filters={filters} page={list.page} pageCount={list.pageCount} />
            </>
          )}
        </section>

        <section id={DETAIL_ID} aria-label="Job details" className={`${showDetailFirst ? "order-1 lg:order-none" : "order-2"} scroll-mt-4 min-w-0`}>
          {selected ? (
            <>
              {showDetailFirst && <ScrollToDetail jobId={selected.id} targetId={DETAIL_ID} />}
              {showDetailFirst && (
                <a href="#list" className="mb-3 inline-flex text-sm font-semibold text-muted hover:text-ink lg:hidden">
                  ↓ Back to the list
                </a>
              )}
              <JobDetail job={selected} now={now} />
            </>
          ) : (
            <div className="card p-8 text-center text-sm text-muted">
              {filters.job ? "That post is no longer open or isn't a fresher role." : "Select a post to see the details."}
              {filters.job && list.total > 0 && (
                <p className="mt-3">
                  <Link href="/" className="font-semibold text-link hover:underline">
                    Back to all posts
                  </Link>
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <FooterBand stats={stats} now={now} />
    </div>
  );
}

function EmptyList({ filtered }: { filtered: boolean }) {
  return (
    <div className="card p-8 text-center">
      <p className="display text-xl">No fresher posts here yet</p>
      <p className="mt-2 text-sm text-muted">
        {filtered
          ? "Nothing matches these filters. Try widening the search."
          : "Posts appear once the ingest run has tagged them as fresher-friendly. Check back after the next refresh."}
      </p>
      {filtered && (
        <Link href="/" className="btn-ghost mt-4">
          Clear filters
        </Link>
      )}
    </div>
  );
}
