import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { Schema } from "effect";

/** Production deployment identity shared by trusted content boundaries. */
export const CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT = "dapper-antelope-269";

/** The deploy identity of the production Worker, which the Alchemy stack binds at deploy time. */
const ProtectedDeployIdentity = Schema.Struct({
  stage: Schema.Literal(PRODUCTION_DEPLOY_STAGE),
});

/** Recognizes the production stage before granting protected content access. */
export const isProtectedProduction = Schema.is(ProtectedDeployIdentity);
