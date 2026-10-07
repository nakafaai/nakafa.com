import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  appUrlKeys,
  contentRuntimeKeys,
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

  it("requires a non-empty public app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nakafa.com");
    expect(appUrlKeys()).toMatchObject({
      NEXT_PUBLIC_APP_URL: "https://nakafa.com",
    });

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(appUrlKeys).toThrow("NEXT_PUBLIC_APP_URL is required.");

    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    expect(appUrlKeys).toThrow("NEXT_PUBLIC_APP_URL is required.");
  });
});
