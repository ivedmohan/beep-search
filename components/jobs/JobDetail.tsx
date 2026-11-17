import Link from "next/link";
import type { PublicJobDetail } from "@/lib/queries/public";
import { AppliedBadge } from "./AppliedBadge";
import { ApplyButton } from "./ApplyButton";
import { descriptionToText } from "./description";
import { ExpandableText } from "./ExpandableText";
import { ClockIcon, ExternalIcon, PinIcon } from "./icons";
import { boardUrl, CITY_LABELS, companyInitial, formatDate, formatPostedAgo, JOB_TYPE_LABELS, KIND_LABELS, ROLE_LABELS } from "./labels";

type Props = {
  job: PublicJobDetail;
  now: Date;
  /** Standalone (/jobs/[id]) hides the permalink since you're already on it. */
  standalone?: boolean;
};

export function JobDetail({ job, now, standalone = false }: Props) {
  const chips: string[] = [];
  if (job.jobType && job.jobType !== "unknown") chips.push(JOB_TYPE_LABELS[job.jobType]);
  if (job.city) chips.push(CITY_LABELS[job.city]);
  if (job.role) chips.push(ROLE_LABELS[job.role]);
  const posted = job.postedAt ?? job.firstSeenAt;
  const confidence = job.llmConfidence == null ? null : Math.round(job.llmConfidence * 100);

  return (
    <article className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="display grid h-11 w-11 place-items-center rounded-full bg-primary text-lg text-ink" aria-hidden>
              {companyInitial(job.company)}
            </span>
            <span className="text-base font-medium text-ink">{job.company}</span>
            <AppliedBadge jobId={job.id} />
          </div>
          {!standalone && (
            <Link href={`/jobs/${job.id}`} className="btn-ghost px-3! py-1.5! text-xs" title="Shareable link to this post" prefetch={false}>
              Permalink
            </Link>
          )}
        </div>

        <h1 className="display mt-4 text-2xl leading-tight sm:text-3xl">{job.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
          <span className="chip-mint">via {KIND_LABELS[job.sourceKind]}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-hairline bg-surface-soft/60 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/80">
          <span className="inline-flex items-center gap-1.5">
            <PinIcon className="text-muted" />
            {job.locationRaw.trim() || "Location not listed"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="text-muted" />
            <time dateTime={posted.toISOString()}>
              {formatDate(posted)} · {formatPostedAgo(posted, now)}
            </time>
          </span>
        </div>
        <ApplyButton jobId={job.id} applyUrl={job.applyUrl} />
      </div>

      <div className="p-5 sm:p-6">
        <h2 className="display text-xl">About the job</h2>
        <div className="mt-3">
          <ExpandableText text={descriptionToText(job.descriptionText)} />
        </div>

        <dl className="mt-6 space-y-2 border-t border-hairline pt-4 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 font-semibold text-ink sm:w-28">Why fresher?</dt>
            <dd className="text-ink/80">
              {job.llmReason?.trim() || "Tagged as fresher-friendly by the LLM tagger."}
              {confidence != null && <span className="text-muted"> · confidence {confidence}%</span>}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0 font-semibold text-ink sm:w-28">Source</dt>
            <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink/80">
              <a
                href={boardUrl(job.sourceKind, job.sourceToken)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-link hover:underline"
              >
                {job.sourceDisplayName} on {KIND_LABELS[job.sourceKind]} <ExternalIcon width={13} height={13} />
              </a>
              <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink hover:underline">
                Original posting <ExternalIcon width={13} height={13} />
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
