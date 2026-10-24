/** Production deployment identity shared by trusted content boundaries. */
export const CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT = "dapper-antelope-269";

/**
 * The deploy stage of the production build. The deploy ships its stage in
 * DEPLOY_STAGE, so only the production build reads the protected content runtime.
 */
export const PRODUCTION_DEPLOY_STAGE = "production";

/** Recognizes the production deploy stage before granting content access. */
export const isProtectedProduction = (stage: string | undefined) =>
  stage === PRODUCTION_DEPLOY_STAGE;
