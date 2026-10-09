import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  contentRuntimeKeys,
  previewKeys,
  publicationKeys,
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

/** Gives every Aksara preview field the same value, or removes each one when undefined. */
function stubPreviewFields(value: string | undefined) {
  vi.stubEnv("AKSARA_PREVIEW_EVENTS_PATH", value);
  vi.stubEnv("AKSARA_PREVIEW_KEY_ID", value);
  vi.stubEnv("AKSARA_PREVIEW_MANIFEST_PATH", value);
  vi.stubEnv("AKSARA_PREVIEW_ORIGIN", value);
  vi.stubEnv("AKSARA_PREVIEW_PUBLIC_KEY", value);
  vi.stubEnv("AKSARA_PREVIEW_PROVIDER_TOKEN", value);
  vi.stubEnv("AKSARA_PREVIEW_RENDERER_SECRET", value);
  vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", value);
}

describe("required server values", () => {
  it("throws when the publication token is unset or empty", () => {
    stubValidEnvironment();
    vi.stubEnv("AKSARA_PUBLICATION_TOKEN", undefined);
    expect(publicationKeys).toThrow();

    vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "");
    expect(publicationKeys).toThrow();
  });

  it("throws when the content runtime token is unset", () => {
    stubValidEnvironment();
    vi.stubEnv("CONTENT_RUNTIME_TOKEN", undefined);

    expect(contentRuntimeKeys).toThrow();
  });

  it("throws when the site URL is unset or empty", () => {
    stubValidEnvironment();
    vi.stubEnv("SITE_URL", undefined);
    expect(siteUrlKeys).toThrow();

    vi.stubEnv("SITE_URL", "");
    expect(siteUrlKeys).toThrow();
  });
});

describe("optional Aksara preview values", () => {
  it("keeps every unset preview field undefined", () => {
    stubPreviewFields(undefined);

    expect(previewKeys()).toStrictEqual({
      AKSARA_PREVIEW_EVENTS_PATH: undefined,
      AKSARA_PREVIEW_KEY_ID: undefined,
      AKSARA_PREVIEW_MANIFEST_PATH: undefined,
      AKSARA_PREVIEW_ORIGIN: undefined,
      AKSARA_PREVIEW_PUBLIC_KEY: undefined,
      AKSARA_PREVIEW_PROVIDER_TOKEN: undefined,
      AKSARA_PREVIEW_RENDERER_SECRET: undefined,
      AKSARA_PREVIEW_RENDERER_TOKEN: undefined,
    });
  });

  it("keeps every empty preview field as a set empty string", () => {
    stubPreviewFields("");

    expect(previewKeys()).toStrictEqual({
      AKSARA_PREVIEW_EVENTS_PATH: "",
      AKSARA_PREVIEW_KEY_ID: "",
      AKSARA_PREVIEW_MANIFEST_PATH: "",
      AKSARA_PREVIEW_ORIGIN: "",
      AKSARA_PREVIEW_PUBLIC_KEY: "",
      AKSARA_PREVIEW_PROVIDER_TOKEN: "",
      AKSARA_PREVIEW_RENDERER_SECRET: "",
      AKSARA_PREVIEW_RENDERER_TOKEN: "",
    });
  });

  it("passes every preview field value through unchanged", () => {
    stubPreviewFields("preview-value");

    expect(previewKeys()).toStrictEqual({
      AKSARA_PREVIEW_EVENTS_PATH: "preview-value",
      AKSARA_PREVIEW_KEY_ID: "preview-value",
      AKSARA_PREVIEW_MANIFEST_PATH: "preview-value",
      AKSARA_PREVIEW_ORIGIN: "preview-value",
      AKSARA_PREVIEW_PUBLIC_KEY: "preview-value",
      AKSARA_PREVIEW_PROVIDER_TOKEN: "preview-value",
      AKSARA_PREVIEW_RENDERER_SECRET: "preview-value",
      AKSARA_PREVIEW_RENDERER_TOKEN: "preview-value",
    });
  });
});
