import { isAiSdkDevToolsTelemetryEnabled } from "@repo/ai/config/devtools-runtime";
import type { OperationalExceptionProperties } from "@repo/analytics/posthog/exception";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import { Effect } from "effect";
import type { Instrumentation } from "next";

/** Registers Node-only startup telemetry after the runtime gate. */
const registerInstrumentation = Effect.fn("www.instrumentation.register")(
  function* () {
    const isEnabled = yield* Effect.sync(
      () =>
        process.env.NEXT_RUNTIME === "nodejs" &&
        isAiSdkDevToolsTelemetryEnabled()
    );
    if (!isEnabled) {
      return;
    }

    const { registerAiSdkDevToolsTelemetry } = yield* Effect.promise(
      () => import("@repo/ai/config/devtools")
    );
    yield* Effect.sync(registerAiSdkDevToolsTelemetry);
  }
);

/**
 * Registers local-only AI SDK DevTools telemetry when the Next.js server starts.
 *
 * The dynamic import keeps Node-only DevTools code out of Edge instrumentation.
 *
 * Docs:
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 * https://ai-sdk.dev/v7/docs/ai-sdk-core/devtools
 */
export function register() {
  return Effect.runPromise(registerInstrumentation());
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

/** Loads Node-only reporting and captures one Next.js request failure. */
const captureRequestError = Effect.fn(
  "www.instrumentation.captureRequestError"
)(function* (error: unknown, properties: OperationalExceptionProperties) {
  const reporting = yield* Effect.tryPromise(
    () => import("@repo/analytics/posthog/server")
  );

  yield* reporting.captureServerException(error, properties);
});

/**
 * Capture uncaught server-side request failures through Next.js instrumentation.
 *
 * Docs:
 * https://nextjs.org/docs/app/guides/instrumentation
 * https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
 * https://posthog.com/docs/error-tracking/installation/nextjs
 */
export const onRequestError = (async (error, request, context) => {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !isServerExceptionReportingEnabled()
  ) {
    return;
  }

  await Effect.runPromise(
    captureRequestError(error, {
      error_digest: getErrorDigest(error),
      method: request.method,
      render_source: context.renderSource,
      revalidate_reason: context.revalidateReason,
      route_path: context.routePath,
      route_type: context.routeType,
      router_kind: context.routerKind,
      source: "next-on-request-error",
    }).pipe(Effect.ignore)
  );
}) satisfies Instrumentation.onRequestError;
