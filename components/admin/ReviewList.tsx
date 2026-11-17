"use client";

import { useMemo, useState } from "react";
import { CITIES, ROLES, type City, type Role } from "@/lib/db/schema";
import type { ReviewSampleRow, ReviewValue } from "@/lib/queries/admin";
import { fmtPct } from "./ui";

type Draft = Omit<ReviewValue, "updatedAt" | "jobId">;

const emptyDraft = (): Draft => ({
  roleCorrect: null,
  cityCorrect: null,
  fresherCorrect: null,
  correctedRole: null,
  correctedCity: null,
  correctedFresher: null,
  note: null,
});

const draftOf = (r: ReviewValue | null): Draft => (r ? { ...emptyDraft(), ...r } : emptyDraft());

interface Accuracy {
  reviewed: number;
  role: { n: number; ok: number };
  city: { n: number; ok: number };
  fresher: { n: number; ok: number };
  overall: { n: number; ok: number };
}

export function computeAccuracy(reviews: (ReviewValue | null)[]): Accuracy {
  const a: Accuracy = { reviewed: 0, role: { n: 0, ok: 0 }, city: { n: 0, ok: 0 }, fresher: { n: 0, ok: 0 }, overall: { n: 0, ok: 0 } };
  for (const r of reviews) {
    if (!r) continue;
    a.reviewed++;
    if (r.roleCorrect != null) {
      a.role.n++;
      if (r.roleCorrect) a.role.ok++;
    }
    if (r.cityCorrect != null) {
      a.city.n++;
      if (r.cityCorrect) a.city.ok++;
    }
    if (r.fresherCorrect != null) {
      a.fresher.n++;
      if (r.fresherCorrect) a.fresher.ok++;
    }
    if (r.roleCorrect != null && r.cityCorrect != null && r.fresherCorrect != null) {
      a.overall.n++;
      if (r.roleCorrect && r.cityCorrect && r.fresherCorrect) a.overall.ok++;
    }
  }
  return a;
}

function Toggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  const base = "px-2.5 py-1 text-xs font-semibold transition";
  return (
    <span className="inline-flex overflow-hidden rounded-[8px] border border-hairline">
      <button type="button" className={`${base} ${value === true ? "bg-primary text-on-primary" : "bg-canvas text-ink hover:bg-surface-soft"}`} onClick={() => onChange(value === true ? null : true)}>
        Correct
      </button>
      <button
        type="button"
        className={`${base} border-l border-hairline ${value === false ? "bg-red-600 text-white" : "bg-canvas text-ink hover:bg-surface-soft"}`}
        onClick={() => onChange(value === false ? null : false)}
      >
        Wrong
      </button>
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="display text-2xl">{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}

export function ReviewList({ rows }: { rows: ReviewSampleRow[] }) {
  const [saved, setSaved] = useState<Record<number, ReviewValue | null>>(() => Object.fromEntries(rows.map((r) => [r.id, r.review])));
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => Object.fromEntries(rows.map((r) => [r.id, draftOf(r.review)])));
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const acc = useMemo(() => computeAccuracy(rows.map((r) => saved[r.id] ?? null)), [rows, saved]);

  const setDraft = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const isDirty = (id: number) => JSON.stringify(drafts[id]) !== JSON.stringify(draftOf(saved[id] ?? null));

  async function save(id: number) {
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: id, ...drafts[id] }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; review?: ReviewValue };
      if (!data.ok || !data.review) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSaved((s) => ({ ...s, [id]: data.review! }));
      setDrafts((d) => ({ ...d, [id]: draftOf(data.review!) }));
    } catch (e) {
      setErrors((er) => ({ ...er, [id]: (e as Error).message }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  const pct = (x: { n: number; ok: number }) => (x.n ? fmtPct(x.ok / x.n, 0) : "—");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Reviewed" value={`${acc.reviewed} / ${rows.length}`} sub="rows with a saved verdict" />
        <Stat label="Role accuracy" value={pct(acc.role)} sub={`${acc.role.ok} of ${acc.role.n} judged`} />
        <Stat label="City accuracy" value={pct(acc.city)} sub={`${acc.city.ok} of ${acc.city.n} judged`} />
        <Stat label="Fresher accuracy" value={pct(acc.fresher)} sub={`${acc.fresher.ok} of ${acc.fresher.n} judged`} />
        <Stat label="Overall" value={pct(acc.overall)} sub={`all 3 correct · ${acc.overall.ok} of ${acc.overall.n}`} />
      </div>

      {rows.length === 0 && (
        <div className="card px-4 py-10 text-center text-muted">
          Nothing to review yet: no open, canonical, LLM-tagged fresher jobs in the database. Run ingest with ANTHROPIC_API_KEY set first.
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const d = drafts[r.id];
          const dirty = isDirty(r.id);
          const sv = saved[r.id];
          return (
            <li key={r.id} className={`card p-4 ${sv && !dirty ? "border-l-4 border-l-primary" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted">
                    #{i + 1} · job {r.id} · {r.sourceKind}
                  </div>
                  <a href={r.applyUrl} target="_blank" rel="noreferrer" className="display text-lg text-ink hover:underline">
                    {r.title}
                  </a>
                  <div className="text-sm">
                    <span className="font-semibold">{r.company}</span>
                    <span className="text-muted"> · {r.locationRaw || "(no location)"}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-link">Description ({r.descriptionText.length.toLocaleString()} chars)</summary>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-[10px] bg-surface-soft p-3 font-sans text-xs leading-relaxed">{r.descriptionText || "(empty)"}</pre>
                  </details>
                </div>
                <div className="w-full shrink-0 rounded-[10px] bg-canvas-mint px-3 py-2 text-xs md:w-72">
                  <div className="mb-1 font-semibold uppercase tracking-wider text-muted">LLM tags</div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <span className="text-muted">role</span>
                    <span className="font-semibold">{r.role ?? "—"}</span>
                    <span className="text-muted">city</span>
                    <span className="font-semibold">{r.city ?? "—"}</span>
                    <span className="text-muted">type</span>
                    <span className="font-semibold">{r.jobType ?? "—"}</span>
                    <span className="text-muted">fresher</span>
                    <span className="font-semibold">{r.isFresher == null ? "—" : r.isFresher ? "yes" : "no"}</span>
                    <span className="text-muted">confidence</span>
                    <span className="font-semibold">{r.llmConfidence == null ? "—" : r.llmConfidence.toFixed(2)}</span>
                    <span className="text-muted">reason</span>
                    <span>{r.llmReason ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 border-t border-hairline pt-3 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-semibold text-muted">
                    Role: <span className="text-ink">{r.role ?? "—"}</span>
                  </div>
                  <Toggle value={d.roleCorrect} onChange={(v) => setDraft(r.id, { roleCorrect: v, correctedRole: v === false ? d.correctedRole : null })} />
                  {d.roleCorrect === false && (
                    <select className="select text-xs" value={d.correctedRole ?? ""} onChange={(e) => setDraft(r.id, { correctedRole: (e.target.value || null) as Role | null })}>
                      <option value="">correct role…</option>
                      {ROLES.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-semibold text-muted">
                    City: <span className="text-ink">{r.city ?? "—"}</span>
                  </div>
                  <Toggle value={d.cityCorrect} onChange={(v) => setDraft(r.id, { cityCorrect: v, correctedCity: v === false ? d.correctedCity : null })} />
                  {d.cityCorrect === false && (
                    <select className="select text-xs" value={d.correctedCity ?? ""} onChange={(e) => setDraft(r.id, { correctedCity: (e.target.value || null) as City | null })}>
                      <option value="">correct city…</option>
                      {CITIES.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-semibold text-muted">
                    Fresher: <span className="text-ink">{r.isFresher == null ? "—" : r.isFresher ? "yes" : "no"}</span>
                  </div>
                  <Toggle value={d.fresherCorrect} onChange={(v) => setDraft(r.id, { fresherCorrect: v, correctedFresher: v === false ? (r.isFresher == null ? null : !r.isFresher) : null })} />
                  {d.fresherCorrect === false && (
                    <select
                      className="select text-xs"
                      value={d.correctedFresher == null ? "" : d.correctedFresher ? "yes" : "no"}
                      onChange={(e) => setDraft(r.id, { correctedFresher: e.target.value === "" ? null : e.target.value === "yes" })}
                    >
                      <option value="">actually…</option>
                      <option value="yes">fresher: yes</option>
                      <option value="no">fresher: no</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className="input flex-1" placeholder="Note (optional)" value={d.note ?? ""} onChange={(e) => setDraft(r.id, { note: e.target.value || null })} />
                <button type="button" className={dirty ? "btn-primary" : "btn-ghost"} disabled={!dirty || !!busy[r.id]} onClick={() => save(r.id)}>
                  {busy[r.id] ? "Saving…" : dirty ? "Save" : sv ? "Saved" : "No changes"}
                </button>
                {errors[r.id] && <span className="text-xs text-red-700">{errors[r.id]}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
