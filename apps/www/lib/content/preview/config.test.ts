// @vitest-environment node

import { Effect, Option, Redacted } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasPreviewConfig,
  previewUrl,
  readPreviewConfig,
  readPreviewRendererConfig,
} from "@/lib/content/preview/config";
import { previewConfig } from "@/test/content-preview";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs the dedicated preview environment boundary. */
function readConfig() {
  return Effect.runPromise(readPreviewConfig());
}

/** Runs the independent local renderer environment boundary. */
function readRendererConfig() {
  return Effect.runPromise(readPreviewRendererConfig());
}

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
  it("gates Effect startup to a configured development child", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", undefined);
    expect(hasPreviewConfig()).toBe(false);

    vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", "partial-token");
    expect(hasPreviewConfig()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(hasPreviewConfig()).toBe(false);
  });

  it("returns one redacted development token", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubPreviewEnvironment();
    const config = await readConfig();

    expect(Option.map(config, ({ token }) => Redacted.value(token))).toEqual(
      Option.some("provider-token")
    );
    expect(Option.map(config, ({ origin }) => origin.toString())).toEqual(
      Option.some("http://127.0.0.1:4000/")
    );
  });

  it("ignores absent and non-development preview configuration", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", undefined);
    await expect(readConfig()).resolves.toEqual(Option.none());

    vi.stubEnv("NODE_ENV", "production");
    stubPreviewEnvironment();
    await expect(readConfig()).resolves.toEqual(Option.none());
  });

  it("fails closed for an invalid development token", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", " ");
    const error = await Effect.runPromise(
      readPreviewConfig().pipe(Effect.flip)
    );

    expect(error._tag).toBe("PreviewConfigError");
  });

  it("keeps provider and renderer credentials independent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubPreviewEnvironment();
    stubRendererEnvironment();

    const [provider, renderer] = await Promise.all([
      readConfig(),
      readRendererConfig(),
    ]);

    expect(Option.map(provider, ({ token }) => Redacted.value(token))).toEqual(
      Option.some("provider-token")
    );
    expect(Option.map(renderer, ({ token }) => Redacted.value(token))).toEqual(
      Option.some("renderer-token")
    );
    expect(Option.map(renderer, ({ secret }) => secret)).toEqual(
      Option.some("s".repeat(43))
    );
  });

  it("ignores absent or production renderer credentials", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(readRendererConfig()).resolves.toEqual(Option.none());

    vi.stubEnv("NODE_ENV", "production");
    stubRendererEnvironment();
    await expect(readRendererConfig()).resolves.toEqual(Option.none());
  });

  it("fails closed for partial or invalid renderer credentials", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "renderer-token");
    await expect(
      Effect.runPromise(readPreviewRendererConfig().pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PreviewRendererConfigError" });

    stubRendererEnvironment();
    vi.stubEnv("AKSARA_PREVIEW_RENDERER_SECRET", "invalid");
    await expect(
      Effect.runPromise(readPreviewRendererConfig().pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PreviewRendererConfigError" });
  });

  it("requires each environment field to use its exact provider endpoint", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubPreviewEnvironment();
    vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", "/v1/manifest");

    await expect(
      Effect.runPromise(readPreviewConfig().pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PreviewConfigError" });
  });

  it("keeps invalid loopback ports in the typed configuration error channel", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubPreviewEnvironment();
    vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://127.0.0.1:99999/");

    await expect(
      Effect.runPromise(readPreviewConfig().pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PreviewConfigError" });
  });

  it("rejects a network path and any resolved origin mismatch", async () => {
    const networkPath = await Effect.runPromise(
      previewUrl(previewConfig, "//attacker.test/steal").pipe(Effect.flip)
    );
    const origin = new URL(previewConfig.origin);
    Object.defineProperty(origin, "origin", {
      value: "http://attacker.test",
    });
    const originMismatch = await Effect.runPromise(
      previewUrl({ ...previewConfig, origin }, "/v1/manifest").pipe(Effect.flip)
    );

    expect(networkPath._tag).toBe("PreviewConfigError");
    expect(originMismatch._tag).toBe("PreviewConfigError");
  });

  it("accepts only the two provider endpoints and exact artifact address", async () => {
    const artifactPath = `/v1/artifacts/sha256%3A${"a".repeat(64)}`;
    const accepted = await Promise.all(
      ["/v1/events", "/v1/manifest", artifactPath].map((path) =>
        Effect.runPromise(previewUrl(previewConfig, path))
      )
    );

    expect(accepted.map((url) => url.pathname)).toEqual([
      "/v1/events",
      "/v1/manifest",
      artifactPath,
    ]);
  });

  it.each([
    "/v1/unknown",
    `/v1/artifacts/sha256%3a${"a".repeat(64)}`,
    `/v1/artifacts/sha256%3A${"A".repeat(64)}`,
    `/v1/artifacts/sha256%3A${"a".repeat(63)}`,
    "/v1/artifacts/%2e%2e%2fmanifest",
    "/v1/manifest?next=artifact",
  ])("rejects non-contract provider path %s", async (path) => {
    await expect(
      Effect.runPromise(previewUrl(previewConfig, path).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PreviewConfigError" });
  });
});
