// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { LocalPreviewManifestSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Effect, Option, Schema } from "effect";
import {
  readPreviewManifest,
  readPreviewSnapshot,
} from "@/lib/content/preview/manifest";
import { makePendingManifest } from "@/test/content-preview";

/** Builds one response whose final URL matches the Fetch contract. */
function response(body: BodyInit | null) {
  const value = new Response(body, {
    headers: { "content-type": "application/json" },
    status: 200,
  });
  Object.defineProperty(value, "url", { value: target });
  return value;
}

/** The request that the readers of one document share; each test starts a new one. */
const request = vi.hoisted(() => ({
  current: new Request("http://127.0.0.1/"),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => request.current,
}));

const target = "http://127.0.0.1:4000/manifest";
const encodeManifest = Schema.encodeSync(
  Schema.fromJsonString(LocalPreviewManifestSchema)
);
/**
 * One fetch for the whole file: Effect's client keeps the first global fetch it reads.
 */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  request.current = new Request("http://127.0.0.1/");
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

  it.effect("reads the strict manifest with the provider credential", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      const manifest = makePendingManifest();
      fetcher.mockResolvedValue(response(encodeManifest(manifest)));

      expect(yield* readPreviewManifest()).toEqual(manifest);
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
    })
  );

  it.effect("rejects invalid configuration before sending a credential", () =>
    Effect.gen(function* () {
      vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", "partial-token");

      expect(yield* readPreviewManifest().pipe(Effect.flip)).toMatchObject({
        _tag: "PreviewConfigError",
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects malformed manifests in the typed integrity channel", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      fetcher.mockResolvedValue(response("{}"));

      expect(yield* readPreviewManifest().pipe(Effect.flip)).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "manifest",
      });
    })
  );

  it.effect("keeps typed transport failures of the manifest reader", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      fetcher.mockRejectedValue(new TypeError("closed"));

      expect(yield* readPreviewManifest().pipe(Effect.flip)).toMatchObject({
        _tag: "PreviewRequestError",
        stage: "connect",
      });
    })
  );

  it.effect("fetches the manifest once for the readers of one request", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      const manifest = makePendingManifest();
      fetcher.mockResolvedValue(response(encodeManifest(manifest)));

      const [snapshot, read] = yield* Effect.all(
        [readPreviewSnapshot(), readPreviewManifest()],
        { concurrency: "unbounded" }
      );
      expect(Option.map(snapshot, (value) => value.manifest)).toEqual(
        Option.some(manifest)
      );
      expect(read).toEqual(manifest);
      expect(fetcher).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("fetches the manifest again for a later request", () =>
    Effect.gen(function* () {
      stubPreviewEnvironment();
      fetcher.mockImplementation(async () =>
        response(encodeManifest(makePendingManifest()))
      );

      yield* readPreviewManifest();
      request.current = new Request("http://127.0.0.1/next");
      yield* readPreviewManifest();
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );
});
