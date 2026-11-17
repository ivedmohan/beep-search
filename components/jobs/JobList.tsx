"use client";

import { useState } from "react";
import { useAppliedMap } from "./applied-store";
import { JobCard, type JobListItem } from "./JobCard";

type Props = {
  items: JobListItem[];
  selectedId: number | null;
  total: number;
  rangeLabel: string;
};

/** Client list: owns the client-side "Applied only" toggle and reads applied state once for all cards. */
export function JobList({ items, selectedId, total, rangeLabel }: Props) {
  const applied = useAppliedMap();
  const [appliedOnly, setAppliedOnly] = useState(false);
  const appliedCount = items.filter((i) => applied[String(i.id)] === "yes").length;
  const visible = appliedOnly ? items.filter((i) => applied[String(i.id)] === "yes") : items;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{total.toLocaleString("en-IN")}</span> fresher posts
          {total > 0 && <span> · {rangeLabel}</span>}
        </p>
        <button
          type="button"
          onClick={() => setAppliedOnly((v) => !v)}
          aria-pressed={appliedOnly}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
            appliedOnly ? "border-ink bg-ink text-on-dark" : "border-hairline bg-canvas text-ink hover:bg-surface-soft"
          }`}
        >
          Applied
          <span className={`rounded-full px-1.5 ${appliedOnly ? "bg-primary text-ink" : "bg-surface-soft text-muted"}`}>{appliedCount}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {appliedOnly ? "You haven't marked any job on this page as applied yet." : "No posts on this page."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <JobCard key={item.id} item={item} selected={item.id === selectedId} applied={applied[String(item.id)] === "yes"} />
          ))}
        </ul>
      )}
    </div>
  );
}
