import { afterEach, describe, expect, it } from "@effect/vitest";
import { isAiSdkDevToolsTelemetryEnabled } from "@repo/ai/config/devtools-runtime";

describe("AI SDK DevTools runtime gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires an explicit local-development opt in", () => {
    vi.stubEnv("AI_SDK_DEVTOOLS", "false");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(isAiSdkDevToolsTelemetryEnabled()).toBe(false);

    vi.stubEnv("AI_SDK_DEVTOOLS", "true");
    expect(isAiSdkDevToolsTelemetryEnabled()).toBe(true);

    vi.stubEnv("VERCEL_ENV", "development");
    expect(isAiSdkDevToolsTelemetryEnabled()).toBe(true);
  });

  it("rejects production and non-development Vercel runtimes", () => {
    vi.stubEnv("AI_SDK_DEVTOOLS", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAiSdkDevToolsTelemetryEnabled()).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isAiSdkDevToolsTelemetryEnabled()).toBe(false);

    vi.stubEnv("VERCEL_ENV", "production");
    expect(isAiSdkDevToolsTelemetryEnabled()).toBe(false);
  });
});
