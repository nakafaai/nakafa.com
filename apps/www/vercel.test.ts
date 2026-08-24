import { describe, expect, it } from "vitest";
import packageJson from "@/package.json";
import { config } from "@/vercel";

describe("www Vercel configuration", () => {
  it("builds only affected production commits", () => {
    expect(config.ignoreCommand).toBe(
      'if [ "$VERCEL_ENV" != "production" ]; then exit 0; fi; turbo query affected --base="$VERCEL_GIT_PREVIOUS_SHA" --packages www --exit-code || exit 1'
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

  it("handles agent routes before the Next.js proxy", () => {
    expect(config.routes).toEqual([
      {
        dest: "https://mcp.nakafa.com/mcp",
        respectOriginCacheControl: false,
        src: "^\\/mcp$",
        transforms: [
          {
            args: "0",
            op: "set",
            target: { key: "x-vercel-enable-rewrite-caching" },
            type: "request.headers",
          },
        ],
      },
      {
        dest: "$NAKAFA_CONVEX_SITE_URL/openapi.json",
        env: ["NAKAFA_CONVEX_SITE_URL"],
        src: "^/openapi\\.json$",
      },
    ]);
  });
});
