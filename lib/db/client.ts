import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __beepPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    max: 5,
    // Neon (and most hosted PG) require TLS; local dev does not.
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
}

export const pool = globalThis.__beepPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalThis.__beepPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
