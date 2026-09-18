import { describe, expect, it } from "bun:test";
import { app } from "./app.ts";

describe("tRPC handler", () => {
  it("answers health.ping", async () => {
    const res = await app.request("/trpc/health.ping");

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body).toMatchObject({ result: { data: { json: { pong: true } } } });
  });

  it("rejects unknown procedures", async () => {
    const res = await app.request("/trpc/health.nope");

    expect(res.status).toBe(404);
  });
});
