import { deploymentKeys } from "@repo/analytics/keys";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";

/**
 * Allows provider-backed server reporting only in the production deploy stage,
 * and only in the deployed request runtime.
 *
 * The Alchemy stack binds the stage it deploys as NAKAFA_DEPLOY_STAGE, so a
 * preview or staging Worker never reports to production.
 *
 * Start sets TSS_PRERENDERING to "true" in the build process while it prerenders
 * pages, so a prerender error never reaches production reporting. Start owns the
 * variable name, and a test pins it to the installed Start version. The gate
 * reads two optional deployment fields through deploymentKeys, which cannot fail
 * validation. Full analytics configuration is validated lazily after this gate
 * passes.
 */
export function isServerExceptionReportingEnabled() {
  const { NAKAFA_DEPLOY_STAGE, TSS_PRERENDERING } = deploymentKeys();
  return (
    NAKAFA_DEPLOY_STAGE === PRODUCTION_DEPLOY_STAGE &&
    TSS_PRERENDERING !== "true"
  );
}
