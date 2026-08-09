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

    constructor() {
      postHogMocks.constructor();
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

    await captureServerException(new Error("request failed"));

    expect(postHogMocks.keys).not.toHaveBeenCalled();
    expect(postHogMocks.constructor).not.toHaveBeenCalled();
  });

  it("initializes once and sends enabled production exceptions", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    const { captureServerException } = await import(
      "@repo/analytics/posthog/server"
    );
    const error = new Error("request failed");
    const properties = { source: "request" };

    await captureServerException(error, "viewer-1", properties);
    await captureServerException(new Error("second failure"));

    expect(postHogMocks.keys).toHaveBeenCalledOnce();
    expect(postHogMocks.constructor).toHaveBeenCalledOnce();
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenNthCalledWith(
      1,
      error,
      "viewer-1",
      properties
    );
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(2);
  });
});
