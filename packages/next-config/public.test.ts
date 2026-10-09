import { afterEach, describe, expect, it } from "@effect/vitest";
import { appUrlKeys } from "@repo/next-config/public";

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("throws when the public app origin is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

    expect(appUrlKeys).toThrow();
  });
});
