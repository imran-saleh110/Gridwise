import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
});

export function getDbEnv() {
  return envSchema.parse(process.env);
}
