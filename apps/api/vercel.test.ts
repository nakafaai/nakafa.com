import { describe, expect, it } from "@effect/vitest";
import { config } from "@/vercel";

describe("API Vercel configuration", () => {
  it("uses the pre-install production scope boundary", () => {
    const ignoreCommand = config.ignoreCommand ?? "";

    expect(ignoreCommand).toBe("sh ../../scripts/vercel/scope.sh api");
    expect(ignoreCommand.length).toBeLessThanOrEqual(256);
    expect(ignoreCommand).not.toContain("node ");
    expect(ignoreCommand).not.toContain("production-acceptance");
  });
});
