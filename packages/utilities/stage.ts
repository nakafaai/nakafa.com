import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/**
 * The Alchemy stage that serves production. The Cloudflare stack binds the stage
 * it deploys to each Worker, so the production identity comes from the deploy
 * and not from the host's own environment.
 */
export const PRODUCTION_DEPLOY_STAGE = "prod";

/** The stage text the stack binds. A local run binds no stage, so the value may be absent. */
export const DeployStageSchema = Schema.UndefinedOr(Schema.String);

/**
 * Reads `NAKAFA_DEPLOY_STAGE`, the one name of the deploy identity. Every server
 * owner reads the stage through this reader, so the name and its Schema live in
 * one place. Server code only: a browser bundle never reads the deploy stage.
 */
export const deployStageKeys = () =>
  readEnvironment(
    { NAKAFA_DEPLOY_STAGE: DeployStageSchema },
    { NAKAFA_DEPLOY_STAGE: process.env.NAKAFA_DEPLOY_STAGE }
  );
