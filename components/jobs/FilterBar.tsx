import Link from "next/link";
import { CITIES, JOB_TYPES, ROLES, SOURCE_KINDS } from "@/lib/db/schema";
import { AutoSubmitSelect } from "./AutoSubmitSelect";
import { DAYS_OPTIONS, hasActiveFilters, type PublicFilters } from "./filters";
import { SearchIcon } from "./icons";
import { CITY_LABELS, JOB_TYPE_LABELS, KIND_LABELS, ROLE_LABELS } from "./labels";

/** GET form: every control maps to a URL param, so the page stays server-rendered and links are shareable. */
export function FilterBar({ filters }: { filters: PublicFilters }) {
  const active = hasActiveFilters(filters);
  return (
    <form method="get" action="/" className="flex flex-wrap items-center gap-3" role="search" aria-label="Search fresher jobs">
      <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-hairline bg-canvas px-3 py-1.5 focus-within:border-ink sm:max-w-[420px] sm:flex-none">
        <SearchIcon className="shrink-0 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Title or company"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-muted"
          maxLength={120}
        />
        <button type="submit" className="btn-primary px-4! py-1.5!">
          Search
        </button>
      </label>

      <AutoSubmitSelect name="city" defaultValue={filters.city ?? ""} aria-label="Location">
        <option value="">Location</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>
            {CITY_LABELS[c]}
          </option>
        ))}
      </AutoSubmitSelect>

      <AutoSubmitSelect name="role" defaultValue={filters.role ?? ""} aria-label="Role">
        <option value="">Role</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </AutoSubmitSelect>

      <AutoSubmitSelect name="type" defaultValue={filters.type ?? ""} aria-label="Job type">
        <option value="">Job type</option>
        {JOB_TYPES.filter((t) => t !== "unknown").map((t) => (
          <option key={t} value={t}>
            {JOB_TYPE_LABELS[t]}
          </option>
        ))}
      </AutoSubmitSelect>

      <AutoSubmitSelect name="kind" defaultValue={filters.kind ?? ""} aria-label="Source">
        <option value="">Source</option>
        {SOURCE_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABELS[k]}
          </option>
        ))}
      </AutoSubmitSelect>

      <AutoSubmitSelect name="days" defaultValue={filters.days ? String(filters.days) : ""} aria-label="Posted within">
        <option value="">Posted anytime</option>
        {DAYS_OPTIONS.map((d) => (
          <option key={d} value={d}>
            Last {d} days
          </option>
        ))}
      </AutoSubmitSelect>

      {active && (
        <Link href="/" className="text-sm font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
          Clear
        </Link>
      )}
    </form>
  );
}
