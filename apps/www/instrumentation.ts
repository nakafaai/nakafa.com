import {
  captureServerException,
  extractDistinctIdFromPostHogCookie,
} from "@repo/analytics/posthog/server";

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
export const onRequestError: import("next/dist/server/instrumentation/types").InstrumentationOnRequestError =
  async (error, request, context) => {
    if (process.env.NEXT_RUNTIME !== "nodejs") {
      return;
    }

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
    );
  };
