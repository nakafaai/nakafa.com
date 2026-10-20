// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PREVIEW_RENDERER_AUTH_FORMAT } from "@nakafa/aksara-contracts/preview/auth";
import { Effect, Redacted } from "effect";
import { serveContentRenderer } from "@/lib/content/internal/renderer.server";

const readPreviewRendererConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/env", () => ({
  /** Provides a deterministic publication key for the renderer route. */
  env: { AKSARA_PUBLICATION_TOKEN: "publication-key" },
}));

vi.mock("@/lib/content/preview/config", () => ({
  /** Controls whether a preview renderer is configured for the request. */
  readPreviewRendererConfig: readPreviewRendererConfigMock,
}));

const SHA256_PATTERN = /^sha256:/u;
const PREVIEW_TOKEN = "preview-key";
const PREVIEW_SECRET = "S".repeat(43);
const NONCE = "N".repeat(43);

/** Creates one renderer request with an optional bearer token and nonce. */
function renderer(headers: Record<string, string> = {}) {
  return serveContentRenderer({
    request: new Request("https://nakafa.com/api/internal/content/renderer", {
      headers,
    }),
  });
}

describe("content renderer route", () => {
  it("returns the renderer manifest to the publication token", async () => {
    readPreviewRendererConfigMock.mockReturnValue(Effect.succeedNone);

    const response = await renderer({
      Authorization: "Bearer publication-key",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      hash: expect.stringMatching(SHA256_PATTERN),
    });
  });

  it("answers 401 when neither token nor preview renderer is configured", async () => {
    readPreviewRendererConfigMock.mockReturnValue(Effect.succeedNone);

    const response = await renderer({ Authorization: "Bearer wrong-key" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("answers 401 when the preview request has no nonce", async () => {
    readPreviewRendererConfigMock.mockReturnValue(
      Effect.succeedSome({
        secret: PREVIEW_SECRET,
        token: Redacted.make(PREVIEW_TOKEN),
      })
    );

    const response = await renderer({
      Authorization: `Bearer ${PREVIEW_TOKEN}`,
    });

    expect(response.status).toBe(401);
  });

  it("answers 401 when the bearer token is not the preview token", async () => {
    readPreviewRendererConfigMock.mockReturnValue(
      Effect.succeedSome({
        secret: PREVIEW_SECRET,
        token: Redacted.make(PREVIEW_TOKEN),
      })
    );

    const response = await renderer({
      Authorization: "Bearer wrong-key",
      "x-aksara-preview-nonce": NONCE,
    });

    expect(response.status).toBe(401);
  });

  it("returns the manifest with a proof bound to the preview nonce", async () => {
    readPreviewRendererConfigMock.mockReturnValue(
      Effect.succeedSome({
        secret: PREVIEW_SECRET,
        token: Redacted.make(PREVIEW_TOKEN),
      })
    );

    const response = await renderer({
      Authorization: `Bearer ${PREVIEW_TOKEN}`,
      "x-aksara-preview-nonce": NONCE,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      format: PREVIEW_RENDERER_AUTH_FORMAT,
      manifest: { hash: expect.stringMatching(SHA256_PATTERN) },
      proof: expect.any(String),
    });
  });
});
