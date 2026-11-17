"use client";

import { useEffect } from "react";

/** On narrow screens the detail pane renders above the list; bring it into view when a card is tapped. */
export function ScrollToDetail({ jobId, targetId }: { jobId: number; targetId: string }) {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    document.getElementById(targetId)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [jobId, targetId]);
  return null;
}
