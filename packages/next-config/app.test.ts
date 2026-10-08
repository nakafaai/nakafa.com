import { afterEach, describe, expect, it } from "@effect/vitest";
import { getAppUrl } from "@repo/next-config/app";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppUrl", () => {
  it("returns the configured public app origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nakafa.com");

    expect(getAppUrl()).toBe("https://nakafa.com");
  });

  it("fails when the public app origin is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    expect(getAppUrl).toThrow("Invalid environment variables");
  });

  it("fails when the public app origin is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);

    expect(getAppUrl).toThrow("Invalid environment variables");
  });
});
