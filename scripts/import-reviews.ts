/** Import hand-check verdicts from a TSV into the reviews table. Usage: pnpm tsx scripts/import-reviews.ts file.tsv "<reviewer label>" */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { Role, City } from "@/lib/db/schema";

const [file, reviewer = "ved"] = process.argv.slice(2);
const lines = readFileSync(file, "utf8").trim().split("\n").slice(1);
const b = (v: string) => (v === "t" ? true : v === "f" ? false : null);
let n = 0;
for (const line of lines) {
  const [id, rc, cc, fc, cr, ccity, cf, note] = line.split("\t");
  await db
    .insert(schema.reviews)
    .values({
      jobId: Number(id), reviewer, roleCorrect: b(rc), cityCorrect: b(cc), fresherCorrect: b(fc),
      correctedRole: (cr || null) as Role | null, correctedCity: (ccity || null) as City | null, correctedFresher: b(cf), note: note || null,
    })
    .onConflictDoUpdate({
      target: schema.reviews.jobId,
      set: { reviewer, roleCorrect: b(rc), cityCorrect: b(cc), fresherCorrect: b(fc), correctedRole: (cr || null) as Role | null, correctedCity: (ccity || null) as City | null, correctedFresher: b(cf), note: note || null, updatedAt: sql`now()` },
    });
  n++;
}
console.log(`imported ${n} reviews as "${reviewer}"`);
process.exit(0);
