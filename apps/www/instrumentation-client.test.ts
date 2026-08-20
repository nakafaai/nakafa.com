// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const initializeAnalyticsMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/analytics/posthog/instrumentation-client", () => ({
  initializeAnalytics: initializeAnalyticsMock,
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  initializeAnalyticsMock.mockReset();
});

describe("browser instrumentation", () => {
  it("does not initialize analytics in an Aksara preview child", async () => {
    vi.stubEnv("NEXT_PUBLIC_AKSARA_PREVIEW_CHILD", "true");

    await import("@/instrumentation-client");

    expect(initializeAnalyticsMock).not.toHaveBeenCalled();
  });

  it("initializes analytics in the production application", async () => {
    vi.stubEnv("NEXT_PUBLIC_AKSARA_PREVIEW_CHILD", "false");

    await import("@/instrumentation-client");

    expect(initializeAnalyticsMock).toHaveBeenCalledOnce();
  });
});
