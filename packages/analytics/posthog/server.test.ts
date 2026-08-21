import { beforeEach, describe, expect, it, vi } from "vitest";

const postHogMocks = vi.hoisted(() => ({
  captureExceptionImmediate: vi.fn(),
  constructor: vi.fn(),
  keys: vi.fn(() => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    POSTHOG_PROXY_HOST: "https://t.nakafa.com",
  })),
}));

vi.mock("@repo/analytics/keys", () => ({
  keys: postHogMocks.keys,
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    captureExceptionImmediate = postHogMocks.captureExceptionImmediate;

    constructor(...args: unknown[]) {
      postHogMocks.constructor(...args);
    }
  },
}));

vi.mock("server-only", () => ({}));

describe("PostHog server reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    postHogMocks.captureExceptionImmediate.mockResolvedValue(undefined);
  });

  it("has no environment or SDK side effects when imported", async () => {
    await import("@repo/analytics/posthog/server");

    expect(postHogMocks.keys).not.toHaveBeenCalled();
    expect(postHogMocks.constructor).not.toHaveBeenCalled();
  });

  it("does not initialize the SDK when reporting is disabled", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    const { captureServerException } = await import(
      "@repo/analytics/posthog/server"
    );

    await captureServerException(new Error("request failed"), {
      source: "disabled-test",
    });

    expect(postHogMocks.keys).not.toHaveBeenCalled();
    expect(postHogMocks.constructor).not.toHaveBeenCalled();
  });

  it("initializes once and sends enabled production exceptions", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    const { captureServerException } = await import(
      "@repo/analytics/posthog/server"
    );
    const error = new Error("request failed for user@example.com");
    const properties = { source: "request" };

    await captureServerException(error, properties);
    await captureServerException(new Error("second failure"), {
      source: "second-request",
    });
    await captureServerException(
      { message: "object secret" },
      { source: "non-error-request" }
    );

    expect(postHogMocks.keys).toHaveBeenCalledOnce();
    expect(postHogMocks.constructor).toHaveBeenCalledExactlyOnceWith(
      "phc_test",
      {
        disableGeoip: true,
        disableSurveys: true,
        enableExceptionAutocapture: false,
        flushAt: 1,
        flushInterval: 0,
        host: "https://t.nakafa.com",
        personProfiles: "never",
        preloadFeatureFlags: false,
        sendFeatureFlagEvent: false,
      }
    );
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: "Operational exception",
        name: "OperationalError",
      }),
      undefined,
      properties
    );
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(3);
    expect(
      JSON.stringify(postHogMocks.captureExceptionImmediate.mock.calls)
    ).not.toContain("user@example.com");
    expect(
      JSON.stringify(postHogMocks.captureExceptionImmediate.mock.calls)
    ).not.toContain("object secret");
  });

  it("drops invalid runtime context before initializing the SDK", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    const { captureServerException } = await import(
      "@repo/analytics/posthog/server"
    );

    await Reflect.apply(captureServerException, undefined, [
      new Error("blocked"),
      { source: "server-test", userId: "user-1" },
    ]);

    expect(postHogMocks.keys).not.toHaveBeenCalled();
    expect(postHogMocks.constructor).not.toHaveBeenCalled();
    expect(postHogMocks.captureExceptionImmediate).not.toHaveBeenCalled();
  });
});
