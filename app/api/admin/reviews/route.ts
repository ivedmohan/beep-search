import { NextResponse } from "next/server";
import { CITIES, ROLES, type City, type Role } from "@/lib/db/schema";
import { upsertReview } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

const bool3 = (v: unknown): boolean | null => (v === true || v === false ? v : null);

/**
 * PUT /api/admin/reviews  (upsert on job_id)
 * Body: `{ jobId, roleCorrect?, cityCorrect?, fresherCorrect?, correctedRole?, correctedCity?, correctedFresher?, note? }`
 * Booleans may be null (= not judged yet). corrected* are only kept when the matching *Correct is false.
 * 200 `{ ok: true, review }`; 400 on bad input.
 */
export async function PUT(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const jobId = Number(b.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) return NextResponse.json({ ok: false, error: "jobId must be a positive integer" }, { status: 400 });

  const roleCorrect = bool3(b.roleCorrect);
  const cityCorrect = bool3(b.cityCorrect);
  const fresherCorrect = bool3(b.fresherCorrect);
  const correctedRole = roleCorrect === false && (ROLES as readonly string[]).includes(String(b.correctedRole)) ? (b.correctedRole as Role) : null;
  const correctedCity = cityCorrect === false && (CITIES as readonly string[]).includes(String(b.correctedCity)) ? (b.correctedCity as City) : null;
  const correctedFresher = fresherCorrect === false ? bool3(b.correctedFresher) : null;
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 1000) : null;

  try {
    const review = await upsertReview({ jobId, roleCorrect, cityCorrect, fresherCorrect, correctedRole, correctedCity, correctedFresher, note });
    return NextResponse.json({ ok: true, review });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ ok: false, error: /foreign key/i.test(msg) ? `job ${jobId} does not exist` : msg }, { status: 400 });
  }
}
