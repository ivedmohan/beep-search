import Link from "next/link";
import { buildHref, type PublicFilters } from "./filters";

export function Pagination({ filters, page, pageCount }: { filters: PublicFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const prev = page > 1 ? buildHref(filters, { page: page - 1, job: null }) : null;
  const next = page < pageCount ? buildHref(filters, { page: page + 1, job: null }) : null;
  const disabled = "btn-ghost pointer-events-none opacity-40";
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
      {prev ? (
        <Link href={prev} className="btn-ghost" prefetch={false}>
          ← Previous
        </Link>
      ) : (
        <span className={disabled}>← Previous</span>
      )}
      <span className="text-sm text-muted">
        Page <span className="font-semibold text-ink">{page}</span> of {pageCount}
      </span>
      {next ? (
        <Link href={next} className="btn-ghost" prefetch={false}>
          Next →
        </Link>
      ) : (
        <span className={disabled}>Next →</span>
      )}
    </nav>
  );
}
