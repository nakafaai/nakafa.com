import { describe, expect, it } from "vitest";
import packageJson from "@/package.json";
import { config, hasIsolatedTypecheck } from "@/vercel";

describe("www Vercel configuration", () => {
  it("builds only affected production commits", () => {
    const ignoreCommand = config.ignoreCommand ?? "";

    expect(ignoreCommand).toContain(
      'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi'
    );
    expect(ignoreCommand).toContain(
      "node ../../scripts/production-acceptance.ts vercel && exit 0"
    );
    expect(ignoreCommand).toContain(
      'turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages www --exit-code || exit 1'
    );
    expect(ignoreCommand.indexOf("production-acceptance.ts")).toBeLessThan(
      ignoreCommand.indexOf("turbo query affected")
    );
    expect(config.git?.deploymentEnabled).toEqual({
      "**": false,
      "changeset-release/main": false,
      main: true,
    });
  });

  it("deploys the matching Convex backend with the production web build", () => {
    const buildCommand = config.buildCommand ?? "";
    const deploymentCommand = packageJson.scripts["build:vercel"];
    const webTypecheck = "pnpm --dir ../../apps/www typecheck";
    const backendTypecheck = "pnpm --dir ../../packages/backend typecheck";
    const convexDeploy = "pnpm --dir ../../packages/backend exec convex deploy";
    const webBuild = "pnpm --dir ../../apps/www build";

    expect(buildCommand).toBe("pnpm run build:vercel");
    expect(buildCommand.length).toBeLessThanOrEqual(256);
    expect(deploymentCommand).toContain("--yes");
    expect(deploymentCommand).toContain("--typecheck disable");
    expect(deploymentCommand).toContain("--typecheck-components");
    expect(deploymentCommand).toContain(
      'NEXT_PUBLIC_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL"'
    );
    expect(deploymentCommand).toContain(
      "--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL"
    );
    expect(deploymentCommand.indexOf(webTypecheck)).toBe(0);
    expect(deploymentCommand.indexOf(backendTypecheck)).toBeGreaterThan(
      deploymentCommand.indexOf(webTypecheck)
    );
    expect(deploymentCommand.indexOf(convexDeploy)).toBeGreaterThan(
      deploymentCommand.indexOf(backendTypecheck)
    );
    expect(deploymentCommand.indexOf(webBuild)).toBeGreaterThan(
      deploymentCommand.indexOf(convexDeploy)
    );
  });

  it("skips only the duplicate Vercel typecheck", () => {
    expect(hasIsolatedTypecheck("1")).toBe(true);
    expect(hasIsolatedTypecheck(undefined)).toBe(false);
  });
});
