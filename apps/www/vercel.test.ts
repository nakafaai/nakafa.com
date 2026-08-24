import { describe, expect, it } from "vitest";
import packageJson from "@/package.json";
import { config } from "@/vercel";

describe("www Vercel configuration", () => {
  it("deploys the matching Convex backend with the production web build", () => {
    const buildCommand = config.buildCommand ?? "";
    const deploymentCommand = packageJson.scripts["build:vercel"];
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
    expect(deploymentCommand.indexOf(backendTypecheck)).toBe(0);
    expect(deploymentCommand.indexOf(convexDeploy)).toBeGreaterThan(
      deploymentCommand.indexOf(backendTypecheck)
    );
    expect(deploymentCommand.indexOf(webBuild)).toBeGreaterThan(
      deploymentCommand.indexOf(convexDeploy)
    );
  });
});
