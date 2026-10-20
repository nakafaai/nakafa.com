// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { LocalPreviewManifestSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Effect, Option, Schema } from "effect";
import {
  readPreviewManifestForPrerender,
  readPreviewSnapshot,
} from "@/lib/content/preview/manifest";
import { makePendingManifest } from "@/test/content-preview";

const target = "http://127.0.0.1:4000/manifest";
const encodeManifest = Schema.encodeSync(
  Schema.fromJsonString(LocalPreviewManifestSchema)
);
/**
 * One fetch for the whole file: these readers end in a Promise, so the double
 * is global, and Effect's client keeps the first global fetch it reads.
 */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Installs one complete test-only child environment. */
function stubPreviewEnvironment() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", "/events");
  vi.stubEnv("AKSARA_PREVIEW_KEY_ID", "local-preview");
  vi.stubEnv("AKSARA_PREVIEW_MANIFEST_PATH", "/manifest");
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
  it.effect(
    "does not fetch a snapshot outside a configured development child",
    () =>
      Effect.gen(function* () {
        stubPreviewEnvironment();
        vi.stubEnv("NODE_ENV", "production");

        expect(yield* readPreviewSnapshot()).toEqual(Option.none());
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reads the authenticated manifest through the Effect boundary",
    () =>
      Effect.gen(function* () {
        stubPreviewEnvironment();
        const manifest = makePendingManifest();
        fetcher.mockResolvedValue(response(encodeManifest(manifest)));

        const snapshot = yield* readPreviewSnapshot();
        expect(Option.map(snapshot, (value) => value.manifest)).toEqual(
          Option.some(manifest)
        );
      })
  );

  it.effect("keeps transport failures in the Effect error channel", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      fetcher.mockRejectedValue(new TypeError("closed"));

      expect(yield* readPreviewSnapshot().pipe(Effect.flip)).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "connect",
      });
    })
  );

  it.effect("keeps manifest failures in the Effect error channel", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      fetcher.mockResolvedValue(response("{}"));

      expect(yield* readPreviewSnapshot().pipe(Effect.flip)).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "manifest",
      });
    })
  );

  it("reads the strict manifest behind the Promise boundary", async () => {
    stubPreviewEnvironment();
    const manifest = makePendingManifest();
    fetcher.mockResolvedValue(response(encodeManifest(manifest)));

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

    await expect(readPreviewManifestForPrerender()).rejects.toMatchObject({
      _tag: "PreviewConfigError",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed manifests in the typed integrity channel", async () => {
    stubPreviewEnvironment();
    fetcher.mockResolvedValue(response("{}"));

    await expect(readPreviewManifestForPrerender()).rejects.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "manifest",
    });
  });

  it("preserves typed transport failures at the Next boundary", async () => {
    stubPreviewEnvironment();
    fetcher.mockRejectedValue(new TypeError("closed"));

    await expect(readPreviewManifestForPrerender()).rejects.toMatchObject({
      _tag: "PreviewRequestError",
      stage: "connect",
    });
  });
});
