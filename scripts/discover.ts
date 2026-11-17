/**
 * Board discovery: given a TSV of `kind<TAB>name<TAB>slug`, fetch each board and
 * report total / India / regex-candidate counts. Output TSV to stdout.
 * Usage: pnpm tsx scripts/discover.ts list.tsv [concurrency]
 */
import { readFileSync } from "node:fs";
import { adapters } from "@/lib/sources";
import { isIndiaPost } from "@/lib/filter/india";
import { regexGate } from "@/lib/filter/regex";
import type { SourceKind } from "@/lib/db/schema";

const file = process.argv[2];
const conc = Number(process.argv[3] ?? 6);
const rows = readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.split("\t"))
  .filter((r) => r.length >= 3 && r[0] in adapters);

let i = 0;
async function worker() {
  while (i < rows.length) {
    const [kind, name, slug] = rows[i++];
    const r = await adapters[kind as SourceKind].fetchBoard(slug.trim());
    if (!r.ok) {
      console.log([kind, name, slug, "BAD", 0, 0, 0, r.error].join("\t"));
      continue;
    }
    const india = r.posts.filter(isIndiaPost);
    const cand = india.filter((p) => regexGate(p).candidate);
    console.log([kind, name, slug, "OK", r.posts.length, india.length, cand.length, cand.slice(0, 3).map((p) => p.title).join(" | ")].join("\t"));
  }
}
await Promise.all(Array.from({ length: conc }, worker));
