"use client";

import { setApplied, useAppliedState } from "./applied-store";
import { ExternalIcon } from "./icons";

/**
 * Opens the ATS posting in a new tab and records `clicked` in localStorage.
 * While the job is in `clicked` state (i.e. the user came back from the ATS tab) we ask "Did you apply?".
 */
export function ApplyButton({ jobId, applyUrl }: { jobId: number; applyUrl: string }) {
  const state = useAppliedState(jobId);
  const applied = state === "yes";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (!applied) setApplied(jobId, "clicked");
        }}
        className={applied ? "btn-green" : "btn-primary"}
      >
        {applied ? "Applied · open again" : "Apply externally"}
        <ExternalIcon />
      </a>
      {state === "clicked" && (
        <span
          role="group"
          aria-label="Did you apply?"
          className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas-mint px-3 py-1.5 text-sm"
        >
          <span className="font-semibold">Did you apply?</span>
          <button type="button" onClick={() => setApplied(jobId, "yes")} className="rounded-full bg-ink px-3 py-0.5 text-xs font-semibold text-on-dark hover:opacity-90">
            Yes
          </button>
          <button type="button" onClick={() => setApplied(jobId, "no")} className="rounded-full border border-ink bg-canvas px-3 py-0.5 text-xs font-semibold text-ink hover:bg-surface-soft">
            No
          </button>
        </span>
      )}
    </div>
  );
}
