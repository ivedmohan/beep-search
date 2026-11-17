"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SOURCE_KINDS, type SourceKind } from "@/lib/db/schema";
import { Alert } from "./ui";

interface Preview {
  ok: true;
  kind: SourceKind;
  token: string;
  company: string;
  postCount: number;
  indiaCount: number;
  sampleTitles: string[];
  boardUrl: string;
  alreadyExists: boolean;
}

const HINT: Record<SourceKind, string> = {
  greenhouse: "board token, e.g. `razorpay` from job-boards.greenhouse.io/razorpay",
  lever: "site slug, e.g. `cred` from jobs.lever.co/cred (case-sensitive)",
  ashby: "org slug, e.g. `zepto` from jobs.ashbyhq.com/zepto",
  smartrecruiters: "company id, e.g. `Freshworks` from careers.smartrecruiters.com/Freshworks",
};

export function AddSourceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SourceKind>("greenhouse");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "validating" | "saving" | "saved">("idle");

  const reset = () => {
    setPreview(null);
    setError(null);
    setPhase("idle");
  };

  async function validate() {
    setPhase("validating");
    setError(null);
    setPreview(null);
    const res = await fetch("/api/admin/sources/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, token }),
    });
    const data = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as Preview | { ok: false; error: string };
    setPhase("idle");
    if (!data.ok) {
      setError(data.error);
      return;
    }
    setPreview(data);
    setToken(data.token);
    if (!displayName.trim()) setDisplayName(data.company || data.token);
  }

  async function save() {
    if (!preview) return;
    setPhase("saving");
    setError(null);
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, token: preview.token, displayName }),
    });
    const data = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; error?: string };
    if (!data.ok) {
      setPhase("idle");
      setError(data.error ?? "save failed");
      return;
    }
    setPhase("saved");
    setToken("");
    setDisplayName("");
    setPreview(null);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn-green" onClick={() => setOpen(true)}>
        + Add source
      </button>
    );
  }

  return (
    <div className="card w-full p-4">
      <div className="flex items-center justify-between">
        <h2 className="display text-xl">Add source</h2>
        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Kind
          <select
            className="select"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as SourceKind);
              reset();
            }}
          >
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Token
          <input
            className="input font-mono"
            value={token}
            placeholder="board slug"
            onChange={(e) => {
              setToken(e.target.value);
              reset();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (token.trim()) void validate();
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Display name
          <input className="input" value={displayName} placeholder="Company name (from the board if empty)" onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" className="btn-ghost" onClick={validate} disabled={!token.trim() || phase === "validating" || phase === "saving"}>
            {phase === "validating" ? "Fetching…" : "Validate"}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={!preview || preview.alreadyExists || phase !== "idle"}>
            {phase === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{HINT[kind]}</p>

      <div className="mt-3 flex flex-col gap-2">
        {error && <Alert kind="error">{error}</Alert>}
        {phase === "saved" && <Alert kind="ok">Saved. The source is enabled; hit Run now on its row to ingest it.</Alert>}
        {preview && (
          <Alert kind={preview.alreadyExists ? "error" : "ok"}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <span className="font-semibold">{preview.company}</span>{" "}
                <a href={preview.boardUrl} target="_blank" rel="noreferrer" className="text-link hover:underline">
                  {preview.kind}/{preview.token}
                </a>
              </span>
              <span>{preview.postCount} posts</span>
              <span className="font-semibold">{preview.indiaCount} India</span>
              {preview.alreadyExists && <span className="font-semibold">Already added: this kind+token exists. Save is disabled.</span>}
            </div>
            {preview.sampleTitles.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {preview.sampleTitles.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            {preview.indiaCount === 0 && <p className="mt-1 text-xs">No India posts matched; titles above are from the whole board.</p>}
          </Alert>
        )}
      </div>
    </div>
  );
}
