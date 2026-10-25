import { afterEach, describe, expect, it } from "@effect/vitest";
import { appUrlKeys } from "@repo/site/public";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public app origin key", () => {
  it("requires a non-empty public app origin", () => {
    vi.stubEnv("VITE_SITE_URL", "https://nakafa.com");
    expect(appUrlKeys()).toMatchObject({
      VITE_SITE_URL: "https://nakafa.com",
    });

    vi.stubEnv("VITE_SITE_URL", "");
    expect(appUrlKeys).toThrow();
  });

  it("throws when the public app origin is unset", () => {
    vi.stubEnv("VITE_SITE_URL", undefined);

    expect(appUrlKeys).toThrow();
  });
});
