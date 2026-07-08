// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

describe("llms constants", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the configured public app origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
    vi.resetModules();

    const { BASE_URL } = await import("@/lib/llms/constants");

    expect(BASE_URL).toBe("https://example.test");
  });

  it("fails when the public app origin is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.resetModules();

    await expect(import("@/lib/llms/constants")).rejects.toThrow(
      "NEXT_PUBLIC_APP_URL is required."
    );
  });
});
