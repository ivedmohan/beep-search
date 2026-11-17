"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/admin", label: "Sources", match: (p) => p === "/admin" },
  { href: "/admin/jobs", label: "Jobs", match: (p) => p.startsWith("/admin/jobs") },
  { href: "/admin/review", label: "Review", match: (p) => p.startsWith("/admin/review") },
  { href: "/admin/stats", label: "Stats", match: (p) => p.startsWith("/admin/stats") },
];

/** Admin chrome: left sub-nav + content. The login page renders without the sub-nav. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <main className="mx-auto flex w-full max-w-[1400px] flex-1 items-start justify-center px-4 py-12 sm:px-6">{children}</main>;
  }
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:gap-6">
      <aside className="md:w-48 md:shrink-0">
        <nav className="card flex flex-row gap-1 overflow-x-auto p-2 md:sticky md:top-4 md:flex-col">
          <div className="hidden px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted md:block">Admin</div>
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition ${active ? "bg-ink text-on-dark" : "text-ink hover:bg-surface-soft"}`}
              >
                {n.label}
              </Link>
            );
          })}
          <form action="/api/admin/logout" method="post" className="md:mt-2 md:border-t md:border-hairline md:pt-2">
            <button type="submit" className="w-full rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-muted transition hover:bg-surface-soft hover:text-ink">
              Logout
            </button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
