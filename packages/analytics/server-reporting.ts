import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

const PRODUCTION_BUILD_PHASE = "phase-production-build";
const deploymentTextSchema = Schema.toStandardSchemaV1(
  Schema.UndefinedOr(Schema.String)
);

/**
 * Reads the two deployment markers that decide whether reporting may start.
 *
 * Both schemas accept any text, so reading them never throws. The full
 * analytics configuration stays in `keys`, which this gate never calls.
 */
function readDeploymentEnv() {
  return createEnv({
    server: {
      NEXT_PHASE: deploymentTextSchema,
      VERCEL_ENV: deploymentTextSchema,
    },
    runtimeEnv: {
      NEXT_PHASE: process.env.NEXT_PHASE,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  });
}

/**
 * Allows provider-backed server reporting only in the deployed request runtime.
 *
 * This gate reads only the two deployment markers, so it must remain safe when
 * Next.js imports instrumentation from inside a static prerender error context.
 * Full analytics configuration is validated lazily after this gate passes.
 *
 * References:
 * https://vercel.com/docs/environment-variables/system-environment-variables
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export function isServerExceptionReportingEnabled() {
  const env = readDeploymentEnv();
  return (
    env.VERCEL_ENV === "production" && env.NEXT_PHASE !== PRODUCTION_BUILD_PHASE
  );
}
