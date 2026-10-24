import { deploymentKeys } from "@repo/analytics/keys";
import { Effect } from "effect";

/**
 * Allows provider-backed server reporting only in the deployed request runtime.
 *
 * Start sets TSS_PRERENDERING to "true" in the build process while it prerenders
 * pages, so a prerender error never reaches production reporting. Start owns the
 * variable name, and a test pins it to the installed Start version. The gate
 * reads two optional deployment fields through deploymentKeys, which cannot fail
 * validation. Full analytics configuration is validated lazily after this gate
 * passes.
 *
 * References:
 * https://vercel.com/docs/environment-variables/system-environment-variables
 */
export function isServerExceptionReportingEnabled() {
  const { TSS_PRERENDERING, VERCEL_ENV } = deploymentKeys();
  return VERCEL_ENV === "production" && TSS_PRERENDERING !== "true";
}

/**
 * Captures one exception that escaped the Start request handler. Reporting runs
 * behind a dynamic import, so the Node-only provider stays out of the browser
 * graph, and a failed capture never replaces the error response. Every error is
 * logged first, so a deployment outside production still shows its cause in the
 * platform logs.
 */
export const reportUncaughtRequestError = Effect.fn(
  "analytics.reportUncaughtRequestError"
)(function* (error: unknown, request: Request) {
  yield* Effect.logError("The request failed with an uncaught error.", error);
  if (!isServerExceptionReportingEnabled()) {
    return;
  }

  yield* Effect.tryPromise(() => import("@repo/analytics/posthog/server")).pipe(
    Effect.flatMap((reporting) =>
      reporting.captureServerException(
        error,
        { method: request.method, source: "start-uncaught-request" },
        request.headers.get("user-agent") ?? undefined
      )
    ),
    Effect.ignore
  );
});
