import { describe, expect, it, vi } from "vitest";
import packageJson from "./package.json";
import { config } from "./vercel";

describe("MCP Vercel routing", () => {
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
      "--cmd 'pnpm --dir ../../apps/mcp typecheck'"
    );
  });

  it("keeps the project edge-only and rewrites MCP directly to Convex", () => {
    expect(config).toMatchObject({
      buildCommand: "pnpm run build:vercel",
      framework: null,
      outputDirectory: "public",
      routes: [
        {
          dest: "https://nakafa.com/developers",
          src: "^/$",
          status: 308,
        },
        {
          dest: "$NAKAFA_CONVEX_SITE_URL/mcp",
          env: ["NAKAFA_CONVEX_SITE_URL"],
          respectOriginCacheControl: false,
          src: "^\\/mcp$",
          transforms: [
            {
              op: "delete",
              target: { key: "x-nakafa-mcp-edge-secret" },
              type: "request.headers",
            },
            {
              args: "$NAKAFA_MCP_EDGE_SECRET",
              env: ["NAKAFA_MCP_EDGE_SECRET"],
              op: "set",
              target: { key: "x-nakafa-mcp-edge-secret" },
              type: "request.headers",
            },
            {
              args: "0",
              op: "set",
              target: { key: "x-vercel-enable-rewrite-caching" },
              type: "request.headers",
            },
          ],
        },
        {
          dest: "/not-found.json",
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
          },
          src: "^/.*$",
          status: 404,
        },
      ],
    });
  });

  it("fails closed if the routing library omits required header transforms", async () => {
    vi.resetModules();
    vi.doMock("@vercel/config/v1", () => ({
      deploymentEnv: (name: string) => `$${name}`,
      routes: {
        rewrite: () => ({ dest: "https://example.com", src: "^/mcp$" }),
      },
    }));

    await expect(import("./vercel")).rejects.toThrow(
      "Expected a transformed Vercel MCP rewrite."
    );
    vi.doUnmock("@vercel/config/v1");
  });
});
