"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminJobRow } from "@/lib/queries/admin";
import { Bool, td, th, truncate } from "./ui";

type Action = "hide" | "unhide" | "mark_not_fresher" | "mark_fresher" | "retag";

function Status({ j }: { j: AdminJobRow }) {
  const chips: React.ReactNode[] = [];
  if (j.closedAt) chips.push(<span key="c" className="chip">closed</span>);
  if (j.hiddenByAdmin) chips.push(<span key="h" className="chip bg-red-50 text-red-700">hidden</span>);
  if (j.canonicalJobId != null)
    chips.push(
      <Link key="d" href={`/admin/jobs?q=${encodeURIComponent("#" + j.canonicalJobId)}&closed=all`} className="chip bg-amber-50 text-amber-800" title="duplicate of">
        dup of #{j.canonicalJobId}
      </Link>,
    );
  if (!chips.length) chips.push(<span key="o" className="chip-mint">open</span>);
  return <div className="flex flex-wrap gap-1">{chips}</div>;
}

export function JobsTable({ rows: initial }: { rows: AdminJobRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<Record<number, Action>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  async function act(j: AdminJobRow, action: Action) {
    setBusy((b) => ({ ...b, [j.id]: action }));
    setErrors((e) => {
      const n = { ...e };
      delete n[j.id];
      return n;
    });
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: j.id, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; job?: AdminJobRow };
      if (data.job) setRows((rs) => rs.map((r) => (r.id === j.id ? data.job! : r)));
      if (!data.ok) setErrors((e) => ({ ...e, [j.id]: data.error ?? `HTTP ${res.status}` }));
    } catch (e) {
      setErrors((er) => ({ ...er, [j.id]: (e as Error).message }));
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[j.id];
        return n;
      });
    }
  }

  const btn = "btn-ghost px-2 py-0.5 text-[11px]";

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1360px] text-sm">
        <thead className="border-b border-hairline bg-surface-soft/60">
          <tr>
            <th className={th}>#</th>
            <th className={th}>Title</th>
            <th className={th}>Company</th>
            <th className={th}>Location</th>
            <th className={th}>City</th>
            <th className={th}>Role</th>
            <th className={th}>Type</th>
            <th className={th}>Fresher</th>
            <th className={th}>Conf</th>
            <th className={th}>Regex</th>
            <th className={th}>Status</th>
            <th className={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={12} className="px-3 py-8 text-center text-muted">
                No jobs match these filters.
              </td>
            </tr>
          )}
          {rows.map((j) => {
            const b = busy[j.id];
            return (
              <tr key={j.id} className={`border-b border-hairline last:border-0 ${j.closedAt || j.hiddenByAdmin ? "text-muted" : ""}`}>
                <td className={`${td} font-mono text-xs text-muted`}>{j.id}</td>
                <td className={`${td} max-w-[320px]`}>
                  <a href={j.applyUrl} target="_blank" rel="noreferrer" className="font-medium text-link hover:underline" title={j.title}>
                    {truncate(j.title, 70)}
                  </a>
                  <div className="text-[11px] text-muted">
                    {j.sourceKind}/{j.sourceToken}
                    {j.llmReason && (
                      <span title={j.llmReason}> · {truncate(j.llmReason, 60)}</span>
                    )}
                  </div>
                </td>
                <td className={`${td} max-w-[160px]`} title={j.company}>
                  {truncate(j.company, 28)}
                </td>
                <td className={`${td} max-w-[160px] text-xs`} title={j.locationRaw}>
                  {truncate(j.locationRaw, 32)}
                </td>
                <td className={`${td} text-xs`}>{j.city ?? <span className="text-muted">—</span>}</td>
                <td className={`${td} text-xs`}>{j.role ?? <span className="text-muted">—</span>}</td>
                <td className={`${td} text-xs`}>{j.jobType ?? <span className="text-muted">—</span>}</td>
                <td className={td}>
                  <Bool v={j.isFresher} />
                  {j.llmModel && <div className="text-[10px] text-muted">{j.llmModel}</div>}
                </td>
                <td className={`${td} tabular-nums text-xs`}>{j.llmConfidence == null ? "—" : j.llmConfidence.toFixed(2)}</td>
                <td className={`${td} text-xs`}>
                  <Bool v={j.regexCandidate} />
                  {j.regexSignals && <div className="max-w-[140px] text-[10px] text-muted" title={j.regexSignals}>{truncate(j.regexSignals, 40)}</div>}
                </td>
                <td className={td}>
                  <Status j={j} />
                </td>
                <td className={td}>
                  <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap">
                    {j.hiddenByAdmin ? (
                      <button type="button" className={btn} disabled={!!b} onClick={() => act(j, "unhide")}>
                        {b === "unhide" ? "…" : "Unhide"}
                      </button>
                    ) : (
                      <button type="button" className={btn} disabled={!!b} onClick={() => act(j, "hide")}>
                        {b === "hide" ? "…" : "Hide"}
                      </button>
                    )}
                    {j.isFresher ? (
                      <button type="button" className={btn} disabled={!!b} onClick={() => act(j, "mark_not_fresher")}>
                        {b === "mark_not_fresher" ? "…" : "Not fresher"}
                      </button>
                    ) : (
                      <button type="button" className={btn} disabled={!!b} onClick={() => act(j, "mark_fresher")}>
                        {b === "mark_fresher" ? "…" : "Mark fresher"}
                      </button>
                    )}
                    <button type="button" className={btn} disabled={!!b} onClick={() => act(j, "retag")}>
                      {b === "retag" ? "Tagging…" : "Retag"}
                    </button>
                  </div>
                  {errors[j.id] && <div className="mt-1 max-w-[240px] text-[11px] text-red-700">{errors[j.id]}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
