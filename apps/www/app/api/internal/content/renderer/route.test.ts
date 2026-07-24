// @vitest-environment node

import { Effect } from "effect";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const manifest = {
  base: {
    authoringComponents: [{ name: "BlockMath", version: 1 }],
    supportedComponents: [{ name: "BlockMath", version: 1 }],
  },
  domains: [],
  format: "nakafa-mdx-renderer-v1",
  hash: `sha256:${"a".repeat(64)}`,
  rendererContractVersion: "1.0.0",
};

vi.mock("server-only", () => ({}));
vi.mock("@repo/next-config/keys", () => ({
  /** Provides the renderer route's narrow internal authentication contract. */
  contentApiKeys: () => ({ INTERNAL_CONTENT_API_KEY: "test-key" }),
}));

vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(manifest),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Creates one renderer request with an optional authorization header. */
function createRequest(authorization?: string) {
  const headers = new Headers();

  if (authorization) {
    headers.set("Authorization", authorization);
  }

  return new NextRequest("https://nakafa.com/api/internal/content/renderer", {
    headers,
  });
}

/** Installs the complete ephemeral environment expected from the CLI child. */
function stubPreviewEnvironment() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", "/v1/events");
  vi.stubEnv("AKSARA_PREVIEW_KEY_ID", "local-preview");
  vi.stubEnv("AKSARA_PREVIEW_MANIFEST_PATH", "/v1/manifest");
  vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://127.0.0.1:4000/");
  vi.stubEnv(
    "AKSARA_PREVIEW_PUBLIC_KEY",
    "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----\n"
  );
  vi.stubEnv("AKSARA_PREVIEW_TOKEN", "ephemeral-token");
}

describe("renderer manifest route", () => {
  it("rejects missing, malformed, and invalid bearer tokens", async () => {
    const { GET } = await import("@/app/api/internal/content/renderer/route");

    const responses = await Promise.all([
      GET(createRequest()),
      GET(createRequest("Basic test-key")),
      GET(createRequest("Bearer wrong-key")),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("returns the exact private no-store envelope", async () => {
    const { GET } = await import("@/app/api/internal/content/renderer/route");
    const response = await GET(createRequest("Bearer test-key"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual(manifest);
  });

  it("accepts only the ephemeral token in the development child", async () => {
    stubPreviewEnvironment();
    const { GET } = await import("@/app/api/internal/content/renderer/route");

    expect((await GET(createRequest("Bearer ephemeral-token"))).status).toBe(
      200
    );
  });
});
