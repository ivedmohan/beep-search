/** Small shared presentational helpers for the admin area (server-safe). */

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return fmtTime(iso);
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtInt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-IN");
}

export function fmtPct(x: number | null | undefined, digits = 1): string {
  return x == null ? "—" : `${(x * 100).toFixed(digits)}%`;
}

export function fmtUsd(x: number | null | undefined, digits = 4): string {
  return x == null ? "—" : `$${x.toFixed(digits)}`;
}

export function truncate(s: string | null | undefined, n = 80): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  const s = status ?? "never";
  const cls =
    s === "ok"
      ? "bg-canvas-mint text-ink"
      : s === "error"
        ? "bg-red-50 text-red-700"
        : s === "running"
          ? "bg-amber-50 text-amber-800"
          : "bg-surface-soft text-muted";
  return <span className={`inline-flex rounded-[8px] px-2 py-0.5 text-xs font-semibold ${cls}`}>{s}</span>;
}

export function Bool({ v }: { v: boolean | null | undefined }) {
  if (v == null) return <span className="text-muted">—</span>;
  return v ? <span className="chip-mint">yes</span> : <span className="chip">no</span>;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok" | "info"; children: React.ReactNode }) {
  const cls =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : kind === "ok"
        ? "border-hairline bg-canvas-mint text-ink"
        : "border-hairline bg-surface-soft text-ink";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-[10px] border px-3 py-2 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted whitespace-nowrap";
export const td = "px-3 py-2 align-top";
