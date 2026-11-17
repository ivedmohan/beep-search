import { NextResponse } from "next/server";
import { ingestSource } from "@/lib/ingest/run";
import { getSource } from "@/lib/queries/admin";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ingest
 * Body: `{ sourceId: number, skipLlm?: boolean }`
 * Runs one source end to end (fetch -> India filter -> upsert -> close -> regex -> LLM, max 150 posts tagged).
 * Returns the IngestSummary plus `log: string[]`; HTTP 200 even when summary.status === "error"
 * (the error is in `summary.error`). 400 on bad input, 404 if the source does not exist.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sourceId?: unknown; skipLlm?: unknown };
  const sourceId = Number(body.sourceId);
  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return NextResponse.json({ ok: false, error: "sourceId must be a positive integer" }, { status: 400 });
  }
  const source = await getSource(sourceId);
  if (!source) return NextResponse.json({ ok: false, error: `source ${sourceId} not found` }, { status: 404 });

  const log: string[] = [];
  try {
    const summary = await ingestSource(source, {
      trigger: "manual",
      skipLlm: body.skipLlm === true,
      llmLimit: 150,
      log: (m) => log.push(m),
    });
    return NextResponse.json({ ok: summary.status === "ok", ...summary, log });
  } catch (e) {
    return NextResponse.json({ ok: false, sourceId, status: "error", error: (e as Error).message, log }, { status: 500 });
  }
}
