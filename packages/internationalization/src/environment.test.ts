import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { hasCandidateLocalePreview } from "@repo/internationalization/src/environment";

const previewEnvironmentNames = [
  "AKSARA_PREVIEW_EVENTS_PATH",
  "AKSARA_PREVIEW_KEY_ID",
  "AKSARA_PREVIEW_MANIFEST_PATH",
  "AKSARA_PREVIEW_ORIGIN",
  "AKSARA_PREVIEW_PUBLIC_KEY",
  "AKSARA_PREVIEW_PROVIDER_TOKEN",
] as const;

beforeEach(() => {
  // A shell inside an Aksara dev child may already export these keys.
  for (const name of previewEnvironmentNames) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hasCandidateLocalePreview", () => {
  it.each(["production", "test"])(
    "stays off when NODE_ENV is %s, even with a preview key set",
    (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("AKSARA_PREVIEW_ORIGIN", "http://localhost:4000");

      expect(hasCandidateLocalePreview()).toBe(false);
    }
  );

  it("stays off in development when no preview key is set", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(hasCandidateLocalePreview()).toBe(false);
  });

  it.each(previewEnvironmentNames)(
    "turns on in development when %s is set",
    (name) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv(name, "value");

      expect(hasCandidateLocalePreview()).toBe(true);
    }
  );

  it("counts an empty preview value as set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AKSARA_PREVIEW_KEY_ID", "");

    expect(hasCandidateLocalePreview()).toBe(true);
  });
});
