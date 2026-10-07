import { afterEach, describe, expect, it } from "@effect/vitest";
import { hasCandidateLocalePreview } from "@repo/internationalization/src/environment";

const PROVIDER_NAMES = [
  "AKSARA_PREVIEW_EVENTS_PATH",
  "AKSARA_PREVIEW_KEY_ID",
  "AKSARA_PREVIEW_MANIFEST_PATH",
  "AKSARA_PREVIEW_ORIGIN",
  "AKSARA_PREVIEW_PUBLIC_KEY",
  "AKSARA_PREVIEW_PROVIDER_TOKEN",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("candidate locale preview", () => {
  it("stays closed outside the development child", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://127.0.0.1:4000/");

    expect(hasCandidateLocalePreview()).toBe(false);
  });

  it("stays closed without any provider field", () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const name of PROVIDER_NAMES) {
      vi.stubEnv(name, undefined);
    }

    expect(hasCandidateLocalePreview()).toBe(false);
  });

  it.each(PROVIDER_NAMES)("opens for the partial provider field %s", (name) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(name, "partial-value");

    expect(hasCandidateLocalePreview()).toBe(true);
  });
});
