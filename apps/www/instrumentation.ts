import { isAiSdkDevToolsTelemetryEnabled } from "@repo/ai/config/devtools-runtime";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import type { Instrumentation } from "next";

/**
 * Registers local-only AI SDK DevTools telemetry when the Next.js server starts.
 *
 * The dynamic import keeps Node-only DevTools code out of Edge instrumentation.
 *
 * Docs:
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 * https://ai-sdk.dev/v7/docs/ai-sdk-core/devtools
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !isAiSdkDevToolsTelemetryEnabled()
  ) {
    return;
  }

  const { registerAiSdkDevToolsTelemetry } = await import(
    "@repo/ai/config/devtools"
  );

  registerAiSdkDevToolsTelemetry();
}

/**
 * Return the React/Next digest that identifies wrapped server render errors.
 *
 * Docs:
 * https://nextjs.org/docs/app/guides/instrumentation
 */
function getErrorDigest(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
  ) {
    return error.digest;
  }

  return;
}

/**
 * Capture uncaught server-side request failures through Next.js instrumentation.
 *
 * Docs:
 * https://nextjs.org/docs/app/guides/instrumentation
 * https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
 * https://posthog.com/docs/error-tracking/installation/nextjs
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !isServerExceptionReportingEnabled()
  ) {
    return;
  }

  const [{ captureServerException }, { extractDistinctIdFromPostHogCookie }] =
    await Promise.all([
      import("@repo/analytics/posthog/server"),
      import("@repo/analytics/posthog/attribution"),
    ]);

  await captureServerException(
    error,
    extractDistinctIdFromPostHogCookie(request.headers.cookie),
    {
      error_digest: getErrorDigest(error),
      method: request.method,
      path: request.path,
      render_source: context.renderSource,
      revalidate_reason: context.revalidateReason,
      route_path: context.routePath,
      route_type: context.routeType,
      router_kind: context.routerKind,
      source: "next-on-request-error",
    }
  ).catch(() => undefined);
};
