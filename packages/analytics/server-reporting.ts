import { deploymentKeys } from "@repo/analytics/keys";

const PRODUCTION_BUILD_PHASE = "phase-production-build";

/**
 * Allows provider-backed server reporting only in the deployed request runtime.
 *
 * The gate reads two optional deployment fields through deploymentKeys, which
 * cannot fail validation, so it stays safe when Next.js imports instrumentation
 * from inside a static prerender error context. Full analytics configuration is
 * validated lazily after this gate passes.
 *
 * References:
 * https://vercel.com/docs/environment-variables/system-environment-variables
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export function isServerExceptionReportingEnabled() {
  const { NEXT_PHASE, VERCEL_ENV } = deploymentKeys();
  return VERCEL_ENV === "production" && NEXT_PHASE !== PRODUCTION_BUILD_PHASE;
}
