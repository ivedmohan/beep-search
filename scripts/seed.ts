/** Seed the sources table from data/seed-sources.tsv (idempotent). */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { db, schema } from "@/lib/db/client";
import type { SourceKind } from "@/lib/db/schema";

const lines = readFileSync("data/seed-sources.tsv", "utf8").trim().split("\n").slice(1);
let n = 0;
for (const line of lines) {
  const [kind, name, token] = line.split("\t");
  if (!kind || !token) continue;
  await db
    .insert(schema.sources)
    .values({ kind: kind as SourceKind, token, displayName: name || token })
    .onConflictDoNothing();
  n++;
}
console.log(`seeded ${n} sources`);
process.exit(0);
