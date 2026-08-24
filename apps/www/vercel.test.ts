import { describe, expect, it } from "vitest";
import { config } from "@/vercel";

describe("www Vercel configuration", () => {
  it("deploys the matching Convex backend with the production web build", () => {
    const buildCommand = config.buildCommand ?? "";
    const backendTypecheck = "pnpm --dir ../../packages/backend typecheck";
    const convexDeploy = "pnpm --dir ../../packages/backend exec convex deploy";
    const webBuild = "pnpm --dir ../../apps/www build";

    expect(buildCommand).toContain("--yes");
    expect(buildCommand).toContain("--typecheck disable");
    expect(buildCommand).toContain("--typecheck-components");
    expect(buildCommand).toContain(
      'NEXT_PUBLIC_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL"'
    );
    expect(buildCommand).toContain(
      "--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL"
    );
    expect(buildCommand.indexOf(backendTypecheck)).toBe(0);
    expect(buildCommand.indexOf(convexDeploy)).toBeGreaterThan(
      buildCommand.indexOf(backendTypecheck)
    );
    expect(buildCommand.indexOf(webBuild)).toBeGreaterThan(
      buildCommand.indexOf(convexDeploy)
    );
  });
});
