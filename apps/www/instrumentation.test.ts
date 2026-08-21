// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const instrumentationMocks = vi.hoisted(() => ({
  captureServerException: vi.fn(),
  isAiSdkDevToolsTelemetryEnabled: vi.fn(),
  isServerExceptionReportingEnabled: vi.fn(),
  postHogModuleLoads: 0,
  registerAiSdkDevToolsTelemetry: vi.fn(),
}));

vi.mock("@repo/ai/config/devtools-runtime", () => ({
  isAiSdkDevToolsTelemetryEnabled:
    instrumentationMocks.isAiSdkDevToolsTelemetryEnabled,
}));

vi.mock("@repo/ai/config/devtools", () => ({
  registerAiSdkDevToolsTelemetry:
    instrumentationMocks.registerAiSdkDevToolsTelemetry,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  isServerExceptionReportingEnabled:
    instrumentationMocks.isServerExceptionReportingEnabled,
}));

vi.mock("@repo/analytics/posthog/server", () => {
  instrumentationMocks.postHogModuleLoads += 1;
  return {
    captureServerException: instrumentationMocks.captureServerException,
  };
});

const request = {
  headers: { cookie: "ph_cookie=encoded" },
  method: "GET",
  path: "/id",
};

const requestContext = {
  renderSource: "react-server-components" as const,
  revalidateReason: undefined,
  routePath: "/[locale]",
  routeType: "render" as const,
  routerKind: "App Router" as const,
};

describe("Next.js instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    instrumentationMocks.captureServerException.mockResolvedValue(undefined);
    instrumentationMocks.isAiSdkDevToolsTelemetryEnabled.mockReturnValue(false);
    instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
      false
    );
  });

  it("registers AI SDK telemetry only in the Node.js runtime", async () => {
    const { register } = await import("@/instrumentation");

    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(
      instrumentationMocks.registerAiSdkDevToolsTelemetry
    ).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await register();
    expect(
      instrumentationMocks.registerAiSdkDevToolsTelemetry
    ).not.toHaveBeenCalled();

    instrumentationMocks.isAiSdkDevToolsTelemetryEnabled.mockReturnValue(true);
    await register();
    expect(
      instrumentationMocks.registerAiSdkDevToolsTelemetry
    ).toHaveBeenCalledOnce();
  });

  it("does not load provider code outside production Node.js", async () => {
    const providerLoadsBefore = instrumentationMocks.postHogModuleLoads;
    const { onRequestError } = await import("@/instrumentation");

    vi.stubEnv("NEXT_RUNTIME", "edge");
    await onRequestError(new Error("edge failure"), request, requestContext);

    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await onRequestError(
      new Error("development failure"),
      request,
      requestContext
    );

    expect(instrumentationMocks.postHogModuleLoads).toBe(providerLoadsBefore);
    expect(instrumentationMocks.captureServerException).not.toHaveBeenCalled();
  });

  it.each(["stale", "on-demand"] as const)(
    "reports production %s revalidation errors",
    async (revalidateReason) => {
      const { onRequestError } = await import("@/instrumentation");
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
        true
      );
      const error = new Error(`${revalidateReason} render failure`);

      await onRequestError(error, request, {
        ...requestContext,
        revalidateReason,
      });

      expect(instrumentationMocks.captureServerException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ revalidate_reason: revalidateReason })
      );
    }
  );

  it("lazily reports production request errors with render context", async () => {
    const { onRequestError } = await import("@/instrumentation");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
      true
    );
    const error = Object.assign(new Error("render failure"), {
      digest: "NEXT_DIGEST",
    });

    await onRequestError(error, request, requestContext);

    expect(instrumentationMocks.captureServerException).toHaveBeenCalledWith(
      error,
      {
        error_digest: "NEXT_DIGEST",
        method: "GET",
        render_source: "react-server-components",
        revalidate_reason: undefined,
        route_path: "/[locale]",
        route_type: "render",
        router_kind: "App Router",
        source: "next-on-request-error",
      }
    );
  });

  it("contains provider failures without replacing the application error", async () => {
    const { onRequestError } = await import("@/instrumentation");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
      true
    );
    instrumentationMocks.captureServerException.mockRejectedValue(
      new Error("provider unavailable")
    );

    await expect(
      onRequestError(new Error("render failure"), request, requestContext)
    ).resolves.toBeUndefined();
  });
});
