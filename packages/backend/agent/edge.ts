import { Schema } from "effect";

const API_EDGE_SECRET_ENVIRONMENT = "NAKAFA_API_EDGE_SECRET";
const API_EDGE_SECRET_HEADER = "x-nakafa-api-edge-secret";
const API_ORIGIN_PATH = "/internal/agent";

const ApiEdgeContractSchema = Schema.Struct({
  originPath: Schema.Literal(API_ORIGIN_PATH),
  secretEnvironment: Schema.Literal(API_EDGE_SECRET_ENVIRONMENT),
  secretHeader: Schema.Literal(API_EDGE_SECRET_HEADER),
});

export type ApiEdgeContract = typeof ApiEdgeContractSchema.Type;

/** Server-only contract shared by the Vercel bridge and Convex origin. */
export const NAKAFA_API_EDGE_CONTRACT: ApiEdgeContract = {
  originPath: API_ORIGIN_PATH,
  secretEnvironment: API_EDGE_SECRET_ENVIRONMENT,
  secretHeader: API_EDGE_SECRET_HEADER,
};

/** Trusted Vercel-provided client address used for pseudonymous quotas. */
export const NAKAFA_EDGE_CLIENT_IP_HEADER = "x-forwarded-for";

/** Projects one protected origin path back to its stable public API path. */
export function projectPublicApiPath(pathname: string) {
  return pathname.slice(NAKAFA_API_EDGE_CONTRACT.originPath.length) || "/";
}
