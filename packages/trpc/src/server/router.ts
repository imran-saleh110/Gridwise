import { healthRouter } from "./features/health/health.router.ts";
import { router } from "./trpc.ts";

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
