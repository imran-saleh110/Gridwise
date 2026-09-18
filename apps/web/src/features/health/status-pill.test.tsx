import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusPill } from "./status-pill.tsx";

describe("StatusPill", () => {
  it("renders the label and a tone class", () => {
    const html = renderToStaticMarkup(
      <StatusPill label="api online" tone="success" />
    );

    expect(html).toContain("api online");
    expect(html).toContain("bg-success/15");
    expect(html).toContain("text-success");
  });
});
