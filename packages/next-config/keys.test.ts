import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  analyzeKeys,
  contentRuntimeKeys,
  publicationKeys,
  readContentRuntimeTarget,
  siteUrlKeys,
} from "@repo/next-config/keys";

/** Installs one complete, valid shared Next environment for each test. */
function stubValidEnvironment() {
  vi.stubEnv("ANALYZE", "false");
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

    expect(analyzeKeys()).toMatchObject({ ANALYZE: "false" });
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
