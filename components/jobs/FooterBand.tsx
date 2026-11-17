import type { PublicStats } from "@/lib/queries/public";
import { formatRefreshedAgo } from "./labels";

export function FooterBand({ stats, now }: { stats: PublicStats; now: Date }) {
  const items = [
    { value: stats.openJobs.toLocaleString("en-IN"), label: "open fresher posts" },
    { value: stats.companies.toLocaleString("en-IN"), label: "companies hiring" },
    { value: formatRefreshedAgo(stats.lastRunAt, now), label: "last refreshed", small: true },
  ];
  return (
    <footer className="mt-10 bg-canvas-mint">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <dl className="grid gap-6 sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col">
              <dd className={`display ${it.small ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"} leading-none`}>{it.value}</dd>
              <dt className="mt-2 text-sm font-medium text-ink/70">{it.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-8 max-w-3xl text-sm text-muted">
          Listings are fetched from public Greenhouse, Lever, Ashby and SmartRecruiters job boards and link back to the original posting.
        </p>
      </div>
    </footer>
  );
}
