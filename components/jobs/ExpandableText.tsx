"use client";

import { useEffect, useRef, useState } from "react";

/** Clamps long text by height with a "Show more" toggle; the toggle only appears when the text actually overflows. */
export function ExpandableText({ text, collapsedHeight = 380 }: { text: string; collapsedHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOverflows(el.scrollHeight > collapsedHeight + 24));
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsedHeight, text]);

  const clamped = overflows && !expanded;
  return (
    <div>
      <div ref={ref} className="relative" style={clamped ? { maxHeight: collapsedHeight, overflow: "hidden" } : undefined}>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/90">{text.trim() || "No description was provided by the employer."}</p>
        {clamped && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-canvas to-transparent" aria-hidden />}
      </div>
      {overflows && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="btn-ghost mt-3" aria-expanded={expanded}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
