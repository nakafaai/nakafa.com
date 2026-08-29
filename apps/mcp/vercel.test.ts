import { describe, expect, it } from "@effect/vitest";
import { config } from "@/vercel";

describe("MCP Vercel configuration", () => {
  it("uses the pre-install production scope boundary", () => {
    const ignoreCommand = config.ignoreCommand ?? "";

    expect(ignoreCommand).toBe("sh ../../scripts/vercel/scope.sh mcp");
    expect(ignoreCommand.length).toBeLessThanOrEqual(256);
    expect(ignoreCommand).not.toContain("node ");
    expect(ignoreCommand).not.toContain("production-acceptance");
  });
});
