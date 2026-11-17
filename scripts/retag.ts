/**
 * Re-run LLM tagging with the current prompt on posts previously tagged by the model.
 *   pnpm tsx scripts/retag.ts          # all open, LLM-tagged posts
 *   pnpm tsx scripts/retag.ts --pending  # only posts that are still untagged
 */
import "dotenv/config";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { tagJobs } from "@/lib/llm/tag";
import { runDedup } from "@/lib/dedup";

const { jobs } = schema;
const pendingOnly = process.argv.includes("--pending");
if (!pendingOnly) {
  // keep a snapshot of the previous tags for before/after comparison
  await db.execute(sql`create table if not exists jobs_tags_prev as select id, is_fresher, role, city, job_type, llm_confidence, llm_reason from jobs where false`);
  await db.execute(sql`truncate jobs_tags_prev`);
  await db.execute(sql`insert into jobs_tags_prev select id, is_fresher, role, city, job_type, llm_confidence, llm_reason from jobs where llm_model like 'claude%'`);
  await db.update(jobs).set({ llmModel: null }).where(and(isNull(jobs.closedAt), like(jobs.llmModel, "claude%")));
}
const pending = await db
  .select({ id: jobs.id, title: jobs.title, company: jobs.company, locationRaw: jobs.locationRaw, descriptionText: jobs.descriptionText })
  .from(jobs)
  .where(and(isNull(jobs.closedAt), eq(jobs.regexCandidate, true), isNull(jobs.llmModel)));
console.log(`retagging ${pending.length} posts`);
const t0 = Date.now();
const n = await tagJobs(pending, { log: (m) => console.log(m) });
const dd = await runDedup();
console.log(JSON.stringify({ tagged: n, pending: pending.length, dedup: dd, seconds: Math.round((Date.now() - t0) / 1000) }));
process.exit(0);
