import Link from "next/link";

/** Beep-style top navigation card. Student identity is hardcoded for the MVP (no accounts). */
export function SiteNav({ active = "jobs" }: { active?: "jobs" | "admin" }) {
  return (
    <header className="px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 rounded-[var(--radius-md)] border border-hairline bg-canvas px-4 py-3 shadow-[var(--shadow-soft)] sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-ink display text-lg">B</span>
            <span className="display text-xl">Beep</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold md:flex">
            <Link href="/" className={active === "jobs" ? "text-link" : "text-ink"}>Job Hub</Link>
            <span className="text-ink/70">Upskill</span>
            <span className="text-ink/70">Resources</span>
            <span className="text-ink/70">Beep School of Design</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn-ghost hidden sm:inline-flex">Admin</Link>
          <span className="btn-ghost hidden sm:inline-flex">Go Premium</span>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-soft text-sm font-bold" title="Ved Mohan (demo student)">VM</span>
        </div>
      </div>
    </header>
  );
}
