const PRODUCTION_BUILD_PHASE = "phase-production-build";

/**
 * Allows provider-backed server reporting only in the deployed request runtime.
 *
 * This dependency-free gate must remain safe when Next.js imports
 * instrumentation from inside a static prerender error context. Full analytics
 * configuration is validated lazily after this gate passes.
 *
 * References:
 * https://vercel.com/docs/environment-variables/system-environment-variables
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export function isServerExceptionReportingEnabled() {
  return (
    process.env.VERCEL_ENV === "production" &&
    process.env.NEXT_PHASE !== PRODUCTION_BUILD_PHASE
  );
}
