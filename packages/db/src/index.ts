import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDbEnv } from "./env.ts";

let cached: ReturnType<typeof createClient> | undefined;

function createClient() {
  const sql = neon(getDbEnv().DATABASE_URL);

  return drizzle({ client: sql });
}

export function db() {
  cached ??= createClient();
  return cached;
}

export type Db = ReturnType<typeof db>;
