import { describe, expect, it } from "vitest";
import { config } from "@/vercel";

describe("MCP Vercel configuration", () => {
  it("skips test-only production commits before affected-package analysis", () => {
    const ignoreCommand = config.ignoreCommand ?? "";

    expect(ignoreCommand).toContain(
      'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi'
    );
    expect(ignoreCommand).toContain(
      "node ../../scripts/production-acceptance.ts vercel && exit 0"
    );
    expect(ignoreCommand).toContain(
      'turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages mcp --exit-code || exit 1'
    );
    expect(ignoreCommand.indexOf("production-acceptance.ts")).toBeLessThan(
      ignoreCommand.indexOf("turbo query affected")
    );
  });
});
