import { describe, expect, it, vi } from "vitest";
import packageJson from "./package.json";
import { config } from "./vercel";

const edgeSecretTransforms = [
  {
    op: "delete",
    target: { key: "x-nakafa-api-edge-secret" },
    type: "request.headers",
  },
  {
    args: "$NAKAFA_API_EDGE_SECRET",
    env: ["NAKAFA_API_EDGE_SECRET"],
    op: "set",
    target: { key: "x-nakafa-api-edge-secret" },
    type: "request.headers",
  },
  {
    args: "0",
    op: "set",
    target: { key: "x-vercel-enable-rewrite-caching" },
    type: "request.headers",
  },
];

describe("API Vercel routing", () => {
  it("deploys Convex before its production edge alias can move", () => {
    const deploymentCommand = packageJson.scripts["build:vercel"];

    expect(config.buildCommand).toBe("pnpm run build:vercel");
    expect(deploymentCommand).toContain(
      "pnpm --dir ../../packages/backend typecheck"
    );
    expect(deploymentCommand).toContain(
      "pnpm --dir ../../packages/backend exec convex deploy"
    );
    expect(deploymentCommand).toContain("--yes");
    expect(deploymentCommand).toContain("--typecheck disable");
    expect(deploymentCommand).toContain("--typecheck-components");
    expect(deploymentCommand).toContain(
      "--cmd 'pnpm --dir ../../apps/api build'"
    );
  });

  it("rewrites public API requests directly to Convex with edge protection", () => {
    expect(config.routes).toEqual([
      {
        dest: "$NAKAFA_CONVEX_SITE_URL/v1",
        env: ["NAKAFA_CONVEX_SITE_URL"],
        respectOriginCacheControl: false,
        src: "^\\/v1$",
        transforms: edgeSecretTransforms,
      },
      {
        dest: "$NAKAFA_CONVEX_SITE_URL/v1/$1",
        env: ["NAKAFA_CONVEX_SITE_URL"],
        respectOriginCacheControl: false,
        src: "^\\/v1(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$",
        transforms: edgeSecretTransforms,
      },
      {
        dest: "$NAKAFA_CONVEX_SITE_URL/openapi.json",
        env: ["NAKAFA_CONVEX_SITE_URL"],
        src: "^/openapi\\.json$",
      },
    ]);
  });

  it("fails closed if the routing library omits required header transforms", async () => {
    vi.resetModules();
    vi.doMock("@vercel/config/v1", () => ({
      deploymentEnv: (name: string) => `$${name}`,
      routes: {
        rewrite: () => ({ dest: "https://example.com", src: "^/v1$" }),
      },
    }));

    await expect(import("./vercel")).rejects.toThrow(
      "Expected a transformed Vercel API rewrite."
    );
    vi.doUnmock("@vercel/config/v1");
  });
});
