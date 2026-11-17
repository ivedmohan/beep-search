"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminSourceRow } from "@/lib/queries/admin";
import { Alert, StatusPill, fmtAgo, fmtInt, td, th, truncate } from "./ui";

export type SourceWithUrl = AdminSourceRow & { boardUrl: string };

interface IngestResult {
  ok: boolean;
  status?: string;
  fetched?: number;
  indiaMatched?: number;
  inserted?: number;
  updated?: number;
  closed?: number;
  llmTagged?: number;
  error?: string;
}

interface RunAllState {
  running: boolean;
  done: number;
  total: number;
  inserted: number;
  updated: number;
  tagged: number;
  errors: number;
  current: string | null;
  dedup: string | null;
  finished: boolean;
}

const idleRunAll: RunAllState = { running: false, done: 0, total: 0, inserted: 0, updated: 0, tagged: 0, errors: 0, current: null, dedup: null, finished: false };

async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !data.error) data.error = `HTTP ${res.status}`;
  return data;
}

function summaryText(r: IngestResult): string {
  if (!r.ok && r.fetched === undefined) return r.error ?? "failed";
  const parts = [
    `fetched ${r.fetched ?? 0}`,
    `india ${r.indiaMatched ?? 0}`,
    `+${r.inserted ?? 0} new`,
    `~${r.updated ?? 0} updated`,
    `−${r.closed ?? 0} closed`,
    `tagged ${r.llmTagged ?? 0}`,
  ];
  if (r.error) parts.push(`error: ${r.error}`);
  return parts.join(" · ");
}

export function SourcesTable({ sources }: { sources: SourceWithUrl[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [busy, setBusy] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, IngestResult>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [runAll, setRunAll] = useState<RunAllState>(idleRunAll);
  const stopRef = useRef(false);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return sources.filter((s) => (!onlyEnabled || s.enabled) && (!q || `${s.kind} ${s.token} ${s.displayName}`.toLowerCase().includes(q)));
  }, [sources, filter, onlyEnabled]);

  const enabledCount = sources.filter((s) => s.enabled).length;

  const setBusyFor = (id: number, v: string | null) =>
    setBusy((b) => {
      const n = { ...b };
      if (v) n[id] = v;
      else delete n[id];
      return n;
    });

  async function runOne(s: SourceWithUrl): Promise<IngestResult> {
    const r = await postJson<IngestResult>("/api/admin/ingest", { sourceId: s.id });
    setResults((m) => ({ ...m, [s.id]: r }));
    return r;
  }

  async function onRunNow(s: SourceWithUrl) {
    setBusyFor(s.id, "run");
    try {
      await runOne(s);
    } finally {
      setBusyFor(s.id, null);
      router.refresh();
    }
  }

  async function onToggle(s: SourceWithUrl) {
    setBusyFor(s.id, "toggle");
    const r = await postJson<{ ok: boolean; error?: string }>("/api/admin/sources", { id: s.id, action: s.enabled ? "disable" : "enable" }, "PATCH");
    setBusyFor(s.id, null);
    if (!r.ok) setRowError((e) => ({ ...e, [s.id]: r.error ?? "failed" }));
    router.refresh();
  }

  async function onDelete(s: SourceWithUrl) {
    setBusyFor(s.id, "delete");
    const r = await postJson<{ ok: boolean; error?: string; closed?: number }>("/api/admin/sources", { id: s.id, action: "delete" }, "PATCH");
    setBusyFor(s.id, null);
    setConfirmDelete(null);
    if (!r.ok) setRowError((e) => ({ ...e, [s.id]: r.error ?? "failed" }));
    else setResults((m) => ({ ...m, [s.id]: { ok: true, fetched: 0, indiaMatched: 0, inserted: 0, updated: 0, closed: r.closed ?? 0, llmTagged: 0 } }));
    router.refresh();
  }

  async function onRunAll() {
    const list = sources.filter((s) => s.enabled);
    stopRef.current = false;
    setRunAll({ ...idleRunAll, running: true, total: list.length });
    const acc = { done: 0, inserted: 0, updated: 0, tagged: 0, errors: 0 };
    for (const s of list) {
      if (stopRef.current) break;
      setRunAll((st) => ({ ...st, current: `${s.kind}/${s.token}` }));
      let r: IngestResult;
      try {
        r = await runOne(s);
      } catch (e) {
        r = { ok: false, error: (e as Error).message };
        setResults((m) => ({ ...m, [s.id]: r }));
      }
      acc.done++;
      acc.inserted += r.inserted ?? 0;
      acc.updated += r.updated ?? 0;
      acc.tagged += r.llmTagged ?? 0;
      if (!r.ok) acc.errors++;
      setRunAll((st) => ({ ...st, ...acc }));
    }
    setRunAll((st) => ({ ...st, current: "dedup…" }));
    const d = await postJson<{ ok: boolean; groups?: number; duplicates?: number; error?: string }>("/api/admin/dedup", {});
    setRunAll((st) => ({
      ...st,
      running: false,
      finished: true,
      current: null,
      dedup: d.ok ? `${fmtInt(d.duplicates)} duplicates in ${fmtInt(d.groups)} groups` : `dedup failed: ${d.error}`,
    }));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <input
          className="input max-w-xs"
          placeholder="Filter sources (kind, token, name)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter sources"
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={onlyEnabled} onChange={(e) => setOnlyEnabled(e.target.checked)} /> Enabled only
        </label>
        <span className="text-sm text-muted">
          {visible.length} of {sources.length} sources · {enabledCount} enabled
        </span>
        <div className="ml-auto flex items-center gap-2">
          {runAll.running ? (
            <button type="button" className="btn-ghost" onClick={() => (stopRef.current = true)}>
              Stop after current
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onRunAll} disabled={enabledCount === 0}>
              Run all enabled ({enabledCount})
            </button>
          )}
        </div>
        {(runAll.running || runAll.finished) && (
          <div className="w-full">
            <Alert kind={runAll.errors > 0 ? "error" : runAll.finished ? "ok" : "info"}>
              <span className="font-semibold">{runAll.running ? "Running" : "Done"}</span> {runAll.done}/{runAll.total}
              {runAll.current && <span className="text-muted"> · {runAll.current}</span>} · +{runAll.inserted} inserted · ~{runAll.updated} updated · {runAll.tagged} tagged ·{" "}
              {runAll.errors} errors
              {runAll.dedup && <span> · dedup: {runAll.dedup}</span>}
            </Alert>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b border-hairline bg-surface-soft/60">
            <tr>
              <th className={th}>Kind</th>
              <th className={th}>Token</th>
              <th className={th}>Name</th>
              <th className={th}>Enabled</th>
              <th className={th}>Last run</th>
              <th className={th}>Status</th>
              <th className={th}>Last error</th>
              <th className={`${th} text-right`}>Open</th>
              <th className={`${th} text-right`}>Fresher</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted">
                  No sources match.
                </td>
              </tr>
            )}
            {visible.map((s) => {
              const b = busy[s.id];
              const r = results[s.id];
              const err = rowError[s.id];
              return (
                <tr key={s.id} className={`border-b border-hairline last:border-0 ${s.enabled ? "" : "text-muted"}`}>
                  <td className={td}>
                    <span className="chip">{s.kind}</span>
                  </td>
                  <td className={`${td} font-mono text-xs`}>
                    <a href={s.boardUrl} target="_blank" rel="noreferrer" className="text-link hover:underline">
                      {s.token}
                    </a>
                  </td>
                  <td className={`${td} font-medium`}>{s.displayName}</td>
                  <td className={td}>{s.enabled ? <span className="chip-mint">on</span> : <span className="chip">off</span>}</td>
                  <td className={`${td} whitespace-nowrap`} title={s.lastRunAt ?? ""} suppressHydrationWarning>
                    {fmtAgo(s.lastRunAt)}
                  </td>
                  <td className={td}>
                    <StatusPill status={s.lastStatus} />
                  </td>
                  <td className={`${td} max-w-[220px] text-xs text-red-700`} title={s.lastError ?? ""}>
                    {truncate(s.lastError, 60)}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(s.openJobs)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(s.openFresher)}</td>
                  <td className={td}>
                    <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                      <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={!!b || runAll.running} onClick={() => onRunNow(s)}>
                        {b === "run" ? "Running…" : "Run now"}
                      </button>
                      <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={!!b} onClick={() => onToggle(s)}>
                        {b === "toggle" ? "…" : s.enabled ? "Disable" : "Enable"}
                      </button>
                      {confirmDelete === s.id ? (
                        <span className="inline-flex items-center gap-1 rounded-[8px] border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                          Disable + close {fmtInt(s.openJobs)} open jobs?
                          <button type="button" className="font-semibold underline" disabled={!!b} onClick={() => onDelete(s)}>
                            {b === "delete" ? "…" : "Yes, delete"}
                          </button>
                          <button type="button" className="underline" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn-ghost px-2.5 py-1 text-xs text-red-700" disabled={!!b} onClick={() => setConfirmDelete(s.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                    {r && (
                      <div className={`mt-1 text-xs ${r.ok ? "text-ink" : "text-red-700"}`}>
                        {summaryText(r)}
                      </div>
                    )}
                    {err && <div className="mt-1 text-xs text-red-700">{err}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
