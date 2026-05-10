import { casApiKey, casUrl, keys } from "@repo/math/keys";
import { ConfigProvider, Effect, Redacted } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const provider = ConfigProvider.fromMap(
  new Map([
    ["MATH_CAS_API_KEY", "secret"],
    ["NEXT_PUBLIC_CAS_URL", "https://cas.nakafa.test"],
  ])
);

describe("math keys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates the CAS env contract with T3 Env Core", () => {
    vi.stubEnv("MATH_CAS_API_KEY", "secret");
    vi.stubEnv("NEXT_PUBLIC_CAS_URL", "https://cas.nakafa.test");

    expect(keys()).toMatchObject({
      MATH_CAS_API_KEY: "secret",
      NEXT_PUBLIC_CAS_URL: "https://cas.nakafa.test",
    });
  });

  it("rejects empty CAS values", () => {
    vi.stubEnv("MATH_CAS_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CAS_URL", "");

    expect(() => keys()).toThrow();
  });

  it("reads the CAS URL through Effect Config", async () => {
    await expect(
      Effect.runPromise(casUrl.pipe(Effect.withConfigProvider(provider)))
    ).resolves.toBe("https://cas.nakafa.test");
  });

  it("keeps the CAS API key redacted", async () => {
    const apiKey = await Effect.runPromise(
      casApiKey.pipe(Effect.withConfigProvider(provider))
    );

    expect(Redacted.value(apiKey)).toBe("secret");
    expect(apiKey.toString()).not.toContain("secret");
  });
});
