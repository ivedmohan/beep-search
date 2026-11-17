import Link from "next/link";
import { getAdminStats } from "@/lib/queries/admin";
import { PageHeader, StatusPill, fmtInt, fmtPct, fmtTime, fmtUsd, td, th, truncate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function Tile({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="display mt-1 text-3xl tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block px-4 py-3 transition hover:bg-surface-soft">
      {body}
    </Link>
  ) : (
    <div className="card px-4 py-3">{body}</div>
  );
}

function CountTable({ title, rows, total }: { title: string; rows: { label: string; count: number }[]; total: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-hairline px-4 py-2 text-sm font-semibold">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-muted">No tagged fresher jobs yet.</td>
            </tr>
          )}
          {rows.map((r) => {
            const share = total ? r.count / total : 0;
            return (
              <tr key={r.label} className="border-b border-hairline last:border-0">
                <td className="px-4 py-1.5">{r.label}</td>
                <td className="w-[40%] px-2 py-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-[4px] bg-surface-soft">
                    <div className="h-full rounded-[4px] bg-primary" style={{ width: `${Math.max(1, share * 100)}%` }} />
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums">{fmtInt(r.count)}</td>
                <td className="w-14 py-1.5 pr-4 text-right text-xs tabular-nums text-muted">{fmtPct(share, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminStatsPage() {
  const s = await getAdminStats();
  const roleTotal = s.byRole.reduce((a, r) => a + r.count, 0);
  const cityTotal = s.byCity.reduce((a, r) => a + r.count, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stats" subtitle="Live counts from the database; refresh the page to update." />

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Pipeline</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Open jobs" value={fmtInt(s.jobs.totalOpen)} sub="India posts, not closed" href="/admin/jobs" />
          <Tile label="Open fresher" value={fmtInt(s.jobs.openFresher)} sub="canonical, not hidden" href="/admin/jobs?fresher=yes" />
          <Tile label="Duplicates" value={fmtInt(s.jobs.duplicates)} sub="open rows linked to a canonical" href="/admin/jobs?dups=1" />
          <Tile label="Untagged" value={fmtInt(s.jobs.untagged)} sub={`open, no llm_model · ${fmtInt(s.jobs.regexVeto)} regex-vetoed`} href="/admin/jobs?fresher=untagged" />
          <Tile label="Sources enabled" value={`${fmtInt(s.sources.enabled)} / ${fmtInt(s.sources.total)}`} sub="enabled / total" href="/admin" />
          <Tile label="Sources erroring" value={fmtInt(s.sources.erroring)} sub="enabled with last_status = error" href="/admin" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">LLM spend</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Total cost" value={fmtUsd(s.llm.totalCostUsd, 4)} sub={`${fmtInt(s.llm.calls)} calls · ${fmtInt(s.llm.failedCalls)} failed`} />
          <Tile label="Posts tagged" value={fmtInt(s.llm.postsTagged)} sub="sum(posts_count) over ok calls" />
          <Tile label="Cost / 1,000 posts" value={s.llm.costPer1k == null ? "—" : fmtUsd(s.llm.costPer1k, 3)} sub="sum(cost) / sum(posts) × 1000" />
          <Tile label="Avg cost / call" value={s.llm.costPerCall == null ? "—" : fmtUsd(s.llm.costPerCall, 5)} sub="total cost / calls (10 posts per call)" />
          <Tile label="Cost / post" value={s.llm.costPerPost == null ? "—" : fmtUsd(s.llm.costPerPost, 5)} sub="total cost / posts tagged" />
          <Tile label="Cost for 50 posts" value={s.llm.costPer50 == null ? "—" : fmtUsd(s.llm.costPer50, 4)} sub="cost / post × 50 (the review sample size)" />
          <Tile label="Avg tokens / post" value={s.llm.avgTokensPerPost == null ? "—" : fmtInt(Math.round(s.llm.avgTokensPerPost))} sub="input + output + cache" />
          <Tile label="Cache hit rate" value={fmtPct(s.llm.cacheHitRate, 1)} sub="cache_read / all prompt tokens" />
          <Tile
            label="Tokens"
            value={fmtInt(s.llm.inputTokens + s.llm.outputTokens + s.llm.cacheReadTokens + s.llm.cacheWriteTokens)}
            sub={`in ${fmtInt(s.llm.inputTokens)} · out ${fmtInt(s.llm.outputTokens)} · cache r/w ${fmtInt(s.llm.cacheReadTokens)}/${fmtInt(s.llm.cacheWriteTokens)}`}
          />
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-hairline px-4 py-2 text-sm font-semibold">Last 15 ingest runs</div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-hairline bg-surface-soft/60">
            <tr>
              <th className={th}>Run</th>
              <th className={th}>Source</th>
              <th className={th}>Started</th>
              <th className={th}>Took</th>
              <th className={th}>Trigger</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Fetched</th>
              <th className={`${th} text-right`}>India</th>
              <th className={`${th} text-right`}>Inserted</th>
              <th className={`${th} text-right`}>Updated</th>
              <th className={`${th} text-right`}>Closed</th>
              <th className={`${th} text-right`}>Tagged</th>
              <th className={th}>Error</th>
            </tr>
          </thead>
          <tbody>
            {s.recentRuns.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-6 text-center text-muted">
                  No runs yet.
                </td>
              </tr>
            )}
            {s.recentRuns.map((r) => {
              const took = r.finishedAt ? `${((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000).toFixed(1)}s` : "…";
              return (
                <tr key={r.id} className="border-b border-hairline last:border-0">
                  <td className={`${td} font-mono text-xs text-muted`}>{r.id}</td>
                  <td className={`${td} font-mono text-xs`}>{r.sourceLabel ?? <span className="text-muted">(deleted)</span>}</td>
                  <td className={`${td} whitespace-nowrap text-xs`}>{fmtTime(r.startedAt)}</td>
                  <td className={`${td} tabular-nums text-xs`}>{took}</td>
                  <td className={`${td} text-xs`}>{r.trigger}</td>
                  <td className={td}>
                    <StatusPill status={r.status} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(r.fetched)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(r.indiaMatched)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(r.inserted)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(r.updated)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(r.closed)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(r.llmTagged)}</td>
                  <td className={`${td} max-w-[240px] text-xs text-red-700`} title={r.error ?? ""}>
                    {truncate(r.error, 70)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card overflow-hidden">
          <div className="border-b border-hairline px-4 py-2 text-sm font-semibold">Posts per source kind</div>
          <table className="w-full text-sm">
            <thead className="border-b border-hairline bg-surface-soft/60">
              <tr>
                <th className={th}>Kind</th>
                <th className={`${th} text-right`}>Sources</th>
                <th className={`${th} text-right`}>Open</th>
                <th className={`${th} text-right`}>Fresher</th>
              </tr>
            </thead>
            <tbody>
              {s.perKind.map((k) => (
                <tr key={k.kind} className="border-b border-hairline last:border-0">
                  <td className={td}>
                    <span className="chip">{k.kind}</span>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(k.sources)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(k.openJobs)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtInt(k.openFresher)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CountTable title="Open fresher jobs by role" rows={s.byRole.map((r) => ({ label: r.role, count: r.count }))} total={roleTotal} />
        <CountTable title="Open fresher jobs by city" rows={s.byCity.map((r) => ({ label: r.city, count: r.count }))} total={cityTotal} />
      </section>
    </div>
  );
}
