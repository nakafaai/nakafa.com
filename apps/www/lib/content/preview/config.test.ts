// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option, Redacted } from "effect";
import {
  hasPreviewConfig,
  previewUrl,
  readPreviewConfig,
  readPreviewRendererConfig,
} from "@/lib/content/preview/config";
import { hasPreviewRendererEnvironment } from "@/lib/content/preview/environment";
import { previewConfig } from "@/test/content-preview";

afterEach(() => {
  vi.unstubAllEnvs();
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

/** Installs complete test-only local renderer credentials. */
function stubRendererEnvironment() {
  vi.stubEnv("AKSARA_PREVIEW_RENDERER_SECRET", "s".repeat(43));
  vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "renderer-token");
}

describe("local preview configuration", () => {
  it.each([
    "AKSARA_PREVIEW_EVENTS_PATH",
    "AKSARA_PREVIEW_KEY_ID",
    "AKSARA_PREVIEW_MANIFEST_PATH",
    "AKSARA_PREVIEW_ORIGIN",
    "AKSARA_PREVIEW_PUBLIC_KEY",
    "AKSARA_PREVIEW_PROVIDER_TOKEN",
  ])("detects the partial provider field %s", (name) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(name, "partial-value");
    expect(hasPreviewConfig()).toBe(true);
  });

  it("rejects absent and production preview environments", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(hasPreviewConfig()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", "partial-token");
    expect(hasPreviewConfig()).toBe(false);
  });

  it("gates renderer mode to an explicit development child", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", undefined);
    expect(hasPreviewRendererEnvironment()).toBe(false);

    vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "partial-token");
    expect(hasPreviewRendererEnvironment()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(hasPreviewRendererEnvironment()).toBe(false);
  });

  it.effect("returns one redacted development token", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "development");
      stubPreviewEnvironment();
      const config = yield* readPreviewConfig();

      expect(Option.map(config, ({ token }) => Redacted.value(token))).toEqual(
        Option.some("provider-token")
      );
      expect(Option.map(config, ({ origin }) => origin.toString())).toEqual(
        Option.some("http://127.0.0.1:4000/")
      );
    })
  );

  it.effect("ignores absent and non-development preview configuration", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", undefined);
      expect(yield* readPreviewConfig()).toEqual(Option.none());

      vi.stubEnv("NODE_ENV", "production");
      stubPreviewEnvironment();
      expect(yield* readPreviewConfig()).toEqual(Option.none());
    })
  );

  it.effect("fails closed for an invalid development token", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", " ");
      const error = yield* readPreviewConfig().pipe(Effect.flip);

      expect(error._tag).toBe("PreviewConfigError");
    })
  );

  it.effect("keeps provider and renderer credentials independent", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "development");
      stubPreviewEnvironment();
      stubRendererEnvironment();

      const [provider, renderer] = yield* Effect.all([
        readPreviewConfig(),
        readPreviewRendererConfig(),
      ]);

      expect(
        Option.map(provider, ({ token }) => Redacted.value(token))
      ).toEqual(Option.some("provider-token"));
      expect(
        Option.map(renderer, ({ token }) => Redacted.value(token))
      ).toEqual(Option.some("renderer-token"));
      expect(Option.map(renderer, ({ secret }) => secret)).toEqual(
        Option.some("s".repeat(43))
      );
    })
  );

  it.effect("ignores absent or production renderer credentials", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "development");
      expect(yield* readPreviewRendererConfig()).toEqual(Option.none());

      vi.stubEnv("NODE_ENV", "production");
      stubRendererEnvironment();
      expect(yield* readPreviewRendererConfig()).toEqual(Option.none());
    })
  );

  it.effect("fails closed for partial or invalid renderer credentials", () =>
    Effect.gen(function* () {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "renderer-token");
      expect(
        yield* readPreviewRendererConfig().pipe(Effect.flip)
      ).toMatchObject({ _tag: "PreviewRendererConfigError" });

      stubRendererEnvironment();
      vi.stubEnv("AKSARA_PREVIEW_RENDERER_SECRET", "invalid");
      expect(
        yield* readPreviewRendererConfig().pipe(Effect.flip)
      ).toMatchObject({ _tag: "PreviewRendererConfigError" });
    })
  );

  it.effect(
    "requires each environment field to use its exact provider endpoint",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("NODE_ENV", "development");
        stubPreviewEnvironment();
        vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", "/v1/manifest");

        expect(yield* readPreviewConfig().pipe(Effect.flip)).toMatchObject({
          _tag: "PreviewConfigError",
        });
      })
  );

  it.effect(
    "keeps invalid loopback ports in the typed configuration error channel",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("NODE_ENV", "development");
        stubPreviewEnvironment();
        vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://127.0.0.1:99999/");

        expect(yield* readPreviewConfig().pipe(Effect.flip)).toMatchObject({
          _tag: "PreviewConfigError",
        });
      })
  );

  it.effect("rejects a network path and any resolved origin mismatch", () =>
    Effect.gen(function* () {
      const networkPath = yield* previewUrl(
        previewConfig,
        "//attacker.test/steal"
      ).pipe(Effect.flip);
      const origin = new URL(previewConfig.origin);
      Object.defineProperty(origin, "origin", {
        value: "http://attacker.test",
      });
      const originMismatch = yield* previewUrl(
        { ...previewConfig, origin },
        "/v1/manifest"
      ).pipe(Effect.flip);

      expect(networkPath._tag).toBe("PreviewConfigError");
      expect(originMismatch._tag).toBe("PreviewConfigError");
    })
  );

  it.effect(
    "accepts only the two provider endpoints and exact artifact address",
    () =>
      Effect.gen(function* () {
        const artifactPath = `/v1/artifacts/sha256%3A${"a".repeat(64)}`;
        const accepted = yield* Effect.all(
          ["/v1/events", "/v1/manifest", artifactPath].map((path) =>
            previewUrl(previewConfig, path)
          )
        );

        expect(accepted.map((url) => url.pathname)).toEqual([
          "/v1/events",
          "/v1/manifest",
          artifactPath,
        ]);
      })
  );

  it.effect.each([
    "/v1/unknown",
    `/v1/artifacts/sha256%3a${"a".repeat(64)}`,
    `/v1/artifacts/sha256%3A${"A".repeat(64)}`,
    `/v1/artifacts/sha256%3A${"a".repeat(63)}`,
    "/v1/artifacts/%2e%2e%2fmanifest",
    "/v1/manifest?next=artifact",
  ])("rejects non-contract provider path %s", (path) =>
    Effect.gen(function* () {
      expect(
        yield* previewUrl(previewConfig, path).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PreviewConfigError" });
    })
  );
});
