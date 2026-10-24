/**
 * The Alchemy stage that serves production. The Cloudflare stack binds the stage
 * it deploys to each Worker, so the production identity comes from the deploy
 * and not from the host's own environment.
 */
export const PRODUCTION_DEPLOY_STAGE = "prod";
