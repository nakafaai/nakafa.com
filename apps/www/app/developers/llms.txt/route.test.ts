import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("developer llms.txt", () => {
  it("serves the scoped developer index as Markdown", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    await expect(response.text()).resolves.toContain(
      "# Nakafa Developer Resources"
    );
  });
});
