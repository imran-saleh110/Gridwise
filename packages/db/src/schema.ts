import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const healthChecks = pgTable("health_checks", {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  detail: text("detail"),
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 64 }).notNull(),
});

export type HealthCheckRecord = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;
