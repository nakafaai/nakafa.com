// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { readPreviewManifestForPrerender } from "@/lib/content/preview/manifest";
import { makePendingManifest } from "@/test/content-preview";

const target = "http://127.0.0.1:4000/v1/manifest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Installs one complete test-only child environment. */
function stubPreviewEnvironment() {
  vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", "/v1/events");
  vi.stubEnv("AKSARA_PREVIEW_KEY_ID", "local-preview");
  vi.stubEnv("AKSARA_PREVIEW_MANIFEST_PATH", "/v1/manifest");
  vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://127.0.0.1:4000/");
  vi.stubEnv(
    "AKSARA_PREVIEW_PUBLIC_KEY",
    "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----\n"
  );
  vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", "provider-token");
}

/** Builds one response whose final URL matches the Fetch contract. */
function response(body: BodyInit | null) {
  const value = new Response(body, {
    headers: { "content-type": "application/json" },
    status: 200,
  });
  Object.defineProperty(value, "url", { value: target });
  return value;
}

describe("local preview prerender manifest", () => {
  it("reads the strict manifest behind Next's direct Promise boundary", async () => {
    stubPreviewEnvironment();
    const manifest = makePendingManifest();
    const fetcher = vi.fn(() =>
      Promise.resolve(response(JSON.stringify(manifest)))
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(readPreviewManifestForPrerender()).resolves.toEqual(manifest);
    expect(fetcher).toHaveBeenCalledWith(
      new URL(target),
      expect.objectContaining({
        cache: "no-store",
        credentials: "omit",
        headers: {
          accept: "application/json",
          authorization: "Bearer provider-token",
        },
      })
    );
  });

  it("rejects invalid configuration before sending a credential", async () => {
    vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", "partial-token");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    await expect(readPreviewManifestForPrerender()).rejects.toMatchObject({
      _tag: "PreviewConfigError",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed manifests in the typed integrity channel", async () => {
    stubPreviewEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response("{}")))
    );

    await expect(readPreviewManifestForPrerender()).rejects.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "manifest",
    });
  });

  it("preserves typed transport failures at the Next boundary", async () => {
    stubPreviewEnvironment();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("closed")))
    );

    await expect(readPreviewManifestForPrerender()).rejects.toMatchObject({
      _tag: "PreviewRequestError",
      stage: "connect",
    });
  });
});
