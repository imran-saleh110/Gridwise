import { describe, expect, it } from "bun:test";
import { app } from "../app.ts";

describe("GET /health", () => {
  it("returns an ok status in the envelope shape", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok" } });
  });

  it("answers unknown routes with the error envelope", async () => {
    const res = await app.request("/does-not-exist");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { message: "Not found", status: 404 },
    });
  });
});
