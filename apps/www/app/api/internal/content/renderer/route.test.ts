// @vitest-environment node

import {
  PreviewRendererNonceSchema,
  PreviewRendererResponseSchema,
  PreviewRendererSecretSchema,
  verifyPreviewRendererProof,
} from "@nakafa/aksara-contracts/preview/auth";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect, Schema } from "effect";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const nonce = PreviewRendererNonceSchema.make("n".repeat(43));
const secret = PreviewRendererSecretSchema.make("s".repeat(43));
const manifest = {
  base: {
    authoringComponents: [{ name: "BlockMath", version: 1 }],
    supportedComponents: [{ name: "BlockMath", version: 1 }],
  },
  domains: RENDERER_DOMAINS.map((name) => ({
    authoringComponents: [],
    name,
    supportedComponents: [],
  })),
  format: "nakafa-mdx-renderer-v1",
  hash: `sha256:${"a".repeat(64)}`,
  publishedDomains: ["mathematics"],
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

/** Creates one renderer request with optional local authentication values. */
function createRequest(
  input: { readonly authorization?: string; readonly nonce?: string } = {}
) {
  const headers = new Headers();

  if (input.authorization) {
    headers.set("Authorization", input.authorization);
  }
  if (input.nonce) {
    headers.set("x-aksara-preview-nonce", input.nonce);
  }

  return new NextRequest("https://nakafa.com/api/internal/content/renderer", {
    headers,
  });
}

/** Installs independent local renderer credentials from the CLI child. */
function stubRendererEnvironment() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AKSARA_PREVIEW_RENDERER_SECRET", secret);
  vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "renderer-token");
}

describe("renderer manifest route", () => {
  it("rejects missing, malformed, and invalid bearer tokens", async () => {
    const { GET } = await import("@/app/api/internal/content/renderer/route");

    const responses = await Promise.all([
      GET(createRequest()),
      GET(createRequest({ authorization: "Basic test-key" })),
      GET(createRequest({ authorization: "Bearer wrong-key" })),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("returns the exact private no-store envelope", async () => {
    const { GET } = await import("@/app/api/internal/content/renderer/route");
    const response = await GET(
      createRequest({ authorization: "Bearer test-key" })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual(manifest);
  });

  it("requires both local renderer credentials and a valid nonce", async () => {
    stubRendererEnvironment();
    const { GET } = await import("@/app/api/internal/content/renderer/route");

    const responses = await Promise.all([
      GET(
        createRequest({
          authorization: "Bearer renderer-token",
        })
      ),
      GET(
        createRequest({
          authorization: "Bearer renderer-token",
          nonce: "invalid",
        })
      ),
      GET(
        createRequest({
          authorization: "Bearer wrong-token",
          nonce,
        })
      ),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401]);
  });

  it("returns a challenge-bound local renderer proof", async () => {
    stubRendererEnvironment();
    const { GET } = await import("@/app/api/internal/content/renderer/route");
    const response = await GET(
      createRequest({
        authorization: "Bearer renderer-token",
        nonce,
      })
    );
    const body = Schema.decodeUnknownSync(PreviewRendererResponseSchema)(
      await response.json()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.manifest).toEqual(manifest);
    await expect(
      Effect.runPromise(
        verifyPreviewRendererProof({
          manifestHash: body.manifest.hash,
          nonce,
          proof: body.proof,
          secret,
        })
      )
    ).resolves.toBeUndefined();
  });
});
