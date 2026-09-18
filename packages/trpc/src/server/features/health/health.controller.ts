import { healthChecksRepository } from "@repo/db/repositories";
import type { HealthReportInput } from "./health.schema.ts";

export const healthController = {
  async history(limit: number) {
    const [records, total] = await Promise.all([
      healthChecksRepository.list(limit),
      healthChecksRepository.countAll(),
    ]);

    return { records, total };
  },
  async report(input: HealthReportInput) {
    const row = await healthChecksRepository.create({
      detail: input.detail ?? null,
      source: input.source,
    });

    return { id: row.id };
  },
};
