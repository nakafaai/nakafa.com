import { describe, expect, it } from "vitest";
import packageJson from "./package.json";
import { config } from "./vercel";

describe("MCP Vercel configuration", () => {
  it("keeps the deployed Next transport without a second Convex deploy owner", () => {
    expect(packageJson.scripts).not.toHaveProperty("build:vercel");
    expect(config.buildCommand).toBeUndefined();
    expect(config.framework).toBeUndefined();
    expect(config.routes).toBeUndefined();
  });

  it("builds only affected production commits", () => {
    expect(config.ignoreCommand).toBe(
      'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages mcp --exit-code || exit 1'
    );
    expect(config.git?.deploymentEnabled).toEqual({
      "**": false,
      "changeset-release/main": false,
      main: true,
    });
  });
});
