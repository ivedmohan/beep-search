/** Recompute dedup keys / canonical links across all open posts. */
import "dotenv/config";
import { runDedup } from "@/lib/dedup";

console.log(JSON.stringify(await runDedup()));
process.exit(0);
