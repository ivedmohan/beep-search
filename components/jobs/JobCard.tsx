import Link from "next/link";
import { CheckIcon, PinIcon } from "./icons";

/** Fully pre-formatted on the server so the client list never recomputes dates (no hydration drift). */
export type JobListItem = {
  id: number;
  title: string;
  company: string;
  initial: string;
  location: string;
  chips: string[];
  postedLabel: string;
  sourceLabel: string;
  href: string;
};

export function JobCard({ item, selected, applied }: { item: JobListItem; selected: boolean; applied: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        scroll={false}
        prefetch={false}
        aria-current={selected ? "true" : undefined}
        className={`card block p-4 transition hover:border-ink/40 ${selected ? "border-link ring-1 ring-link shadow-[var(--shadow-soft)]" : ""}`}
      >
        <div className="flex gap-3">
          <span className="display grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-lg text-ink" aria-hidden>
            {item.initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold leading-snug text-link">{item.title}</h3>
              {applied && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-ink">
                  <CheckIcon width={12} height={12} /> Applied
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink/80">{item.company}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <PinIcon className="shrink-0" />
              <span className="truncate">{item.location || "Location not listed"}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {item.chips.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
              <span className="chip-mint">posted {item.postedLabel}</span>
              <span className="text-xs text-muted">via {item.sourceLabel}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
