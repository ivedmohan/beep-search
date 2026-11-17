"use client";

import { useAppliedState } from "./applied-store";
import { CheckIcon } from "./icons";

export function AppliedBadge({ jobId }: { jobId: number }) {
  const state = useAppliedState(jobId);
  if (state !== "yes") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-ink">
      <CheckIcon width={13} height={13} /> Applied
    </span>
  );
}
