import { count, desc } from "drizzle-orm";
import { db } from "../index.ts";
import type { NewHealthCheck } from "../schema.ts";
import { healthChecks } from "../schema.ts";

class HealthChecksRepository {
  async create(input: NewHealthCheck) {
    const [row] = await db()
      .insert(healthChecks)
      .values(input)
      .returning({ id: healthChecks.id });

    if (!row) {
      throw new Error("Failed to insert health check");
    }

    return row;
  }

  list(limit: number) {
    return db()
      .select()
      .from(healthChecks)
      .orderBy(desc(healthChecks.createdAt))
      .limit(limit);
  }

  async countAll() {
    const [row] = await db().select({ value: count() }).from(healthChecks);

    return row?.value ?? 0;
  }
}

export const healthChecksRepository = new HealthChecksRepository();
