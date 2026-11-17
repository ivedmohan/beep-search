import { NextResponse } from "next/server";
import { tagJobs } from "@/lib/llm/tag";
import { db, schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { getJobRow, updateJob } from "@/lib/queries/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ACTIONS = ["hide", "unhide", "mark_not_fresher", "mark_fresher", "retag"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * PATCH /api/admin/jobs
 * Body: `{ id, action }` with action in hide | unhide | mark_not_fresher | mark_fresher | retag.
 * retag clears llm_model and re-runs the LLM for that single job (needs ANTHROPIC_API_KEY).
 * 200 `{ ok: true, job: AdminJobRow }`; on retag failure 200 `{ ok: false, error, job }` with the job unchanged.
 * 400 on bad input, 404 if the job does not exist.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = Number(body.id);
  const action = String(body.action ?? "") as Action;
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "id must be a positive integer" }, { status: 400 });
  if (!ACTIONS.includes(action)) return NextResponse.json({ ok: false, error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });

  const before = await getJobRow(id);
  if (!before) return NextResponse.json({ ok: false, error: `job ${id} not found` }, { status: 404 });

  switch (action) {
    case "hide":
      await updateJob(id, { hiddenByAdmin: true });
      break;
    case "unhide":
      await updateJob(id, { hiddenByAdmin: false });
      break;
    case "mark_not_fresher":
      await updateJob(id, { isFresher: false, llmModel: before.llmModel ?? "admin", llmReason: "admin override: not fresher" });
      break;
    case "mark_fresher":
      await updateJob(id, { isFresher: true, llmModel: before.llmModel ?? "admin", llmReason: "admin override: fresher" });
      break;
    case "retag": {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY is not set; cannot retag", job: before });
      }
      const [full] = await db
        .select({ id: schema.jobs.id, title: schema.jobs.title, company: schema.jobs.company, locationRaw: schema.jobs.locationRaw, descriptionText: schema.jobs.descriptionText })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, id))
        .limit(1);
      await updateJob(id, { llmModel: null });
      const log: string[] = [];
      let tagged = 0;
      try {
        tagged = await tagJobs([full], { runId: null, log: (m) => log.push(m) });
      } catch (e) {
        log.push((e as Error).message);
      }
      if (tagged === 0) {
        // Restore the previous tag so the row is not left half-updated.
        await updateJob(id, { llmModel: before.llmModel });
        const job = await getJobRow(id);
        return NextResponse.json({ ok: false, error: `retag failed: ${log.join(" | ") || "model returned no tag"}`, job });
      }
      break;
    }
  }
  const job = await getJobRow(id);
  return NextResponse.json({ ok: true, job });
}
