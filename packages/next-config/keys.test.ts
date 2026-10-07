import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  appUrlKeys,
  contentRuntimeKeys,
  previewKeys,
  publicationKeys,
  readContentRuntimeTarget,
  siteUrlKeys,
} from "@repo/next-config/keys";

/** Installs one complete, valid shared Next environment for each test. */
function stubValidEnvironment() {
  vi.stubEnv("CONTENT_RUNTIME_TOKEN", "runtime-token");
  vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "publication-token");
  vi.stubEnv("SITE_URL", "https://nakafa.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shared Next environment keys", () => {
  it("decodes every capability from one complete environment", () => {
    stubValidEnvironment();

    expect(publicationKeys()).toMatchObject({
      AKSARA_PUBLICATION_TOKEN: "publication-token",
    });
    expect(contentRuntimeKeys()).toMatchObject({
      CONTENT_RUNTIME_TOKEN: "runtime-token",
    });
    expect(readContentRuntimeTarget("https://example.convex.site")).toEqual({
      siteUrl: "https://example.convex.site",
      token: "runtime-token",
    });
    expect(siteUrlKeys()).toMatchObject({ SITE_URL: "https://nakafa.com" });
  });

  it("rejects an invalid required site URL", () => {
    stubValidEnvironment();
    vi.stubEnv("SITE_URL", "not-a-url");
    expect(siteUrlKeys).toThrow();
  });

  it("requires the executable-content values independently", () => {
    stubValidEnvironment();
    vi.stubEnv("CONTENT_RUNTIME_TOKEN", "");

    expect(contentRuntimeKeys).toThrow();

    vi.stubEnv("CONTENT_RUNTIME_TOKEN", "runtime-token");
    expect(contentRuntimeKeys()).toMatchObject({
      CONTENT_RUNTIME_TOKEN: "runtime-token",
    });
  });
});

describe("public app origin key", () => {
  it("requires a non-empty public app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nakafa.com");
    expect(appUrlKeys()).toMatchObject({
      NEXT_PUBLIC_APP_URL: "https://nakafa.com",
    });

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appUrlKeys).toThrow();
  });
});

describe("Aksara preview keys", () => {
  it("keeps each unset optional preview field absent", () => {
    vi.stubEnv("AKSARA_PREVIEW_ORIGIN", undefined);
    vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", undefined);

    expect(previewKeys().AKSARA_PREVIEW_ORIGIN).toBeUndefined();
    expect(previewKeys().AKSARA_PREVIEW_RENDERER_TOKEN).toBeUndefined();
  });

  it("counts an empty optional preview field as set without checking its format", () => {
    vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "");
    vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", "not a path");

    expect(previewKeys()).toMatchObject({
      AKSARA_PREVIEW_EVENTS_PATH: "not a path",
      AKSARA_PREVIEW_ORIGIN: "",
    });
  });
});
