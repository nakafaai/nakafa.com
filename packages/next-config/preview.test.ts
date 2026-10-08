import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  hasPreviewProvider,
  hasPreviewRenderer,
} from "@repo/next-config/preview";

const PROVIDER_NAMES = [
  "AKSARA_PREVIEW_EVENTS_PATH",
  "AKSARA_PREVIEW_KEY_ID",
  "AKSARA_PREVIEW_MANIFEST_PATH",
  "AKSARA_PREVIEW_ORIGIN",
  "AKSARA_PREVIEW_PUBLIC_KEY",
  "AKSARA_PREVIEW_PROVIDER_TOKEN",
] as const;

const RENDERER_NAMES = [
  "AKSARA_PREVIEW_RENDERER_SECRET",
  "AKSARA_PREVIEW_RENDERER_TOKEN",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Clears every preview field so each case starts from an absent child. */
function clearPreviewFields() {
  for (const name of [...PROVIDER_NAMES, ...RENDERER_NAMES]) {
    vi.stubEnv(name, undefined);
  }
}

describe("Aksara preview child checks", () => {
  it("stays closed outside the development child", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://127.0.0.1:4000/");
    vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "renderer-token");

    expect(hasPreviewProvider()).toBe(false);
    expect(hasPreviewRenderer()).toBe(false);
  });

  it("stays closed without any preview field", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearPreviewFields();

    expect(hasPreviewProvider()).toBe(false);
    expect(hasPreviewRenderer()).toBe(false);
  });

  it.each(PROVIDER_NAMES)(
    "opens the provider check for the partial field %s",
    (name) => {
      vi.stubEnv("NODE_ENV", "development");
      clearPreviewFields();
      vi.stubEnv(name, "partial-value");

      expect(hasPreviewProvider()).toBe(true);
      expect(hasPreviewRenderer()).toBe(false);
    }
  );

  it.each(RENDERER_NAMES)(
    "opens the renderer check for the partial field %s",
    (name) => {
      vi.stubEnv("NODE_ENV", "development");
      clearPreviewFields();
      vi.stubEnv(name, "partial-value");

      expect(hasPreviewRenderer()).toBe(true);
      expect(hasPreviewProvider()).toBe(false);
    }
  );

  it("counts an empty string as a set field", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearPreviewFields();
    vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "");
    expect(hasPreviewProvider()).toBe(true);

    clearPreviewFields();
    vi.stubEnv("AKSARA_PREVIEW_RENDERER_TOKEN", "");
    expect(hasPreviewRenderer()).toBe(true);
  });
});
