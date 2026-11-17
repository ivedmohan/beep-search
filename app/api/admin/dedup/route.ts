import { NextResponse } from "next/server";
import { runDedup } from "@/lib/dedup";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** POST /api/admin/dedup: recomputes dedup keys/canonical links across open jobs. Returns `{ ok, groups, duplicates }`. */
export async function POST() {
  try {
    const res = await runDedup();
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
