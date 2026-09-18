import { app } from "./app.ts";

export default {
  fetch: app.fetch,
  idleTimeout: 30,
  port: Number(process.env.PORT ?? 3001),
};
