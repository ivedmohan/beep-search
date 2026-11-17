import { getReviewSample } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * GET /api/admin/reviews/export
 * Returns the stable 50-row review sample with LLM tags and review verdicts as text/csv.
 */
export async function GET() {
  const rows = await getReviewSample();
  const header = [
    "job_id", "title", "company", "location_raw", "source_kind", "apply_url",
    "llm_role", "llm_city", "llm_job_type", "llm_is_fresher", "llm_confidence", "llm_reason", "llm_model",
    "reviewed", "role_correct", "city_correct", "fresher_correct", "corrected_role", "corrected_city", "corrected_fresher", "note", "reviewed_at",
    "description_excerpt",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const v = r.review;
    lines.push(
      [
        r.id, r.title, r.company, r.locationRaw, r.sourceKind, r.applyUrl,
        r.role, r.city, r.jobType, r.isFresher, r.llmConfidence, r.llmReason, r.llmModel,
        v ? "true" : "false", v?.roleCorrect, v?.cityCorrect, v?.fresherCorrect, v?.correctedRole, v?.correctedCity, v?.correctedFresher, v?.note, v?.updatedAt,
        r.descriptionText.replace(/\s+/g, " ").slice(0, 500),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="beep-review-sample-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
