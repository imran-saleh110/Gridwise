import { publicProcedure, router } from "../../trpc.ts";
import { healthController } from "./health.controller.ts";
import { healthHistorySchema, healthReportSchema } from "./health.schema.ts";

export const healthRouter = router({
  history: publicProcedure
    .input(healthHistorySchema)
    .query(({ input }) => healthController.history(input.limit)),
  ping: publicProcedure.query(() => ({ pong: true })),

  report: publicProcedure
    .input(healthReportSchema)
    .mutation(({ input }) => healthController.report(input)),
});
