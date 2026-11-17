/**
 * Full ingest (used by GitHub Actions cron and locally).
 *   pnpm tsx scripts/ingest.ts            # all enabled sources
 *   pnpm tsx scripts/ingest.ts --no-llm   # skip LLM tagging
 *   pnpm tsx scripts/ingest.ts --ids 1,2  # specific source ids
 */
import "dotenv/config";
import { ingestAll } from "@/lib/ingest/run";
import { runDedup } from "@/lib/dedup";

const args = process.argv.slice(2);
const skipLlm = args.includes("--no-llm");
const idsArg = args[args.indexOf("--ids") + 1];
const sourceIds = args.includes("--ids") && idsArg ? idsArg.split(",").map(Number) : undefined;
const trigger = process.env.GITHUB_ACTIONS ? "cron" : "manual";

const t0 = Date.now();
const results = await ingestAll({ trigger, skipLlm, sourceIds, log: (m) => console.log(m) });
const tot = results.reduce(
  (a, r) => ({
    fetched: a.fetched + r.fetched, india: a.india + r.indiaMatched, inserted: a.inserted + r.inserted,
    updated: a.updated + r.updated, closed: a.closed + r.closed, tagged: a.tagged + r.llmTagged,
    errors: a.errors + (r.status === "error" ? 1 : 0),
  }),
  { fetched: 0, india: 0, inserted: 0, updated: 0, closed: 0, tagged: 0, errors: 0 },
);
const dd = await runDedup();
console.log(JSON.stringify({ sources: results.length, ...tot, dedup: dd, seconds: Math.round((Date.now() - t0) / 1000) }));
process.exit(tot.errors === results.length && results.length > 0 ? 1 : 0);
