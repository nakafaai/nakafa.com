import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("root llms.txt", () => {
  it("serves the agent index as cache-safe Markdown", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
    await expect(response.text()).resolves.toContain("When to use Nakafa");
  });
});
