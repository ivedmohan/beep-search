import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";
import { descriptionToText } from "@/components/jobs/description";
import { FooterBand } from "@/components/jobs/FooterBand";
import { JobDetail } from "@/components/jobs/JobDetail";
import { getPublicJob, getPublicStats } from "@/lib/queries/public";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const job = id ? await getPublicJob(id) : null;
  if (!job) return { title: "Post not found · Beep Job Hub" };
  return {
    title: `${job.title} at ${job.company} · Beep Job Hub`,
    description: descriptionToText(job.descriptionText).slice(0, 160),
  };
}

/** Shareable per-job URL. Same visibility rules as the board; closed/hidden/non-fresher posts 404. */
export default async function JobPage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const now = new Date();
  const [job, stats] = await Promise.all([getPublicJob(id), getPublicStats()]);
  if (!job) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav active="jobs" />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-6 sm:px-6">
        <Link href={`/?job=${job.id}`} className="mb-4 inline-flex text-sm font-semibold text-muted hover:text-ink" prefetch={false}>
          ← All fresher posts
        </Link>
        <JobDetail job={job} now={now} standalone />
      </main>
      <FooterBand stats={stats} now={now} />
    </div>
  );
}
