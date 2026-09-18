import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@repo/trpc/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { EnergyAppError } from "@repo/energy/errors";
import { healthRoutes } from "./routes/health.ts";
import { optimizeEnergyRoutes } from "./routes/optimize-energy.ts";

const app = new Hono();

if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}

app.use("*", cors());

app.use(
  "/trpc/*",
  trpcServer({
    createContext: (_opts, c) => ({
      requestId: c.req.header("x-request-id"),
    }),
    router: appRouter,
  })
);

app.route("/health", healthRoutes);
app.route("/optimize-energy", optimizeEnergyRoutes);

app.notFound((c) =>
  c.json({ error: { message: "Not found", status: 404 } }, 404)
);

app.onError((err, c) => {
  if (err instanceof EnergyAppError) {
    const pub = err.toPublicResponse();
    return c.json({ error: pub }, pub.status as 422 | 500);
  }

  console.error(err);

  return c.json(
    { error: { message: "Something went wrong", status: 500 } },
    500
  );
});

export { app };
