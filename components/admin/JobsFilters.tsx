"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SOURCE_KINDS } from "@/lib/db/schema";
import { filtersToQuery } from "@/components/admin/filters";
import type { JobFilters } from "@/lib/queries/admin";


const lbl = "flex flex-col gap-1 text-xs font-semibold text-muted";

export function JobsFilters({ initial }: { initial: JobFilters }) {
  const router = useRouter();
  const [f, setF] = useState<JobFilters>(initial);
  const set = <K extends keyof JobFilters>(k: K, v: JobFilters[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/admin/jobs${filtersToQuery(f, 1)}`);
      }}
    >
      <label className={`${lbl} min-w-[220px] flex-1`}>
        Search
        <input className="input" placeholder="title, company or location" value={f.q ?? ""} onChange={(e) => set("q", e.target.value || undefined)} />
      </label>
      <label className={lbl}>
        Source
        <select className="select" value={f.kind ?? ""} onChange={(e) => set("kind", (e.target.value || undefined) as JobFilters["kind"])}>
          <option value="">any</option>
          {SOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        Fresher
        <select className="select" value={f.fresher ?? ""} onChange={(e) => set("fresher", (e.target.value || undefined) as JobFilters["fresher"])}>
          <option value="">any</option>
          <option value="yes">yes</option>
          <option value="no">no</option>
          <option value="untagged">untagged</option>
        </select>
      </label>
      <label className={lbl}>
        Regex candidate
        <select className="select" value={f.regex ?? ""} onChange={(e) => set("regex", (e.target.value || undefined) as JobFilters["regex"])}>
          <option value="">any</option>
          <option value="yes">yes</option>
          <option value="no">no (vetoed)</option>
        </select>
      </label>
      <label className={lbl}>
        Hidden
        <select className="select" value={f.hidden ?? "any"} onChange={(e) => set("hidden", e.target.value as JobFilters["hidden"])}>
          <option value="any">any</option>
          <option value="yes">hidden only</option>
          <option value="no">not hidden</option>
        </select>
      </label>
      <label className={lbl}>
        Status
        <select className="select" value={f.closed ?? "open"} onChange={(e) => set("closed", e.target.value as JobFilters["closed"])}>
          <option value="open">open</option>
          <option value="closed">closed</option>
          <option value="all">all</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm font-medium">
        <input type="checkbox" checked={!!f.dups} onChange={(e) => set("dups", e.target.checked)} /> Duplicates only
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary">
          Apply
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setF({ hidden: "any", closed: "open", page: 1 });
            router.push("/admin/jobs");
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
