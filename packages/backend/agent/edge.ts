import { Schema } from "effect";

const API_EDGE_SECRET_ENVIRONMENT = "NAKAFA_API_EDGE_SECRET";
const API_EDGE_SECRET_HEADER = "x-nakafa-api-edge-secret";
const API_DOCUMENT_PATH = "/openapi";
const API_ORIGIN_PATH = "/internal/agent";
const API_PUBLIC_PATH = "/v1";
const API_RUNTIME_PATH = "/runtime";
const AGENT_ORIGIN_ENVIRONMENT = "NAKAFA_CONVEX_SITE_URL";
const MCP_EDGE_SECRET_ENVIRONMENT = "NAKAFA_MCP_EDGE_SECRET";
const MCP_EDGE_SECRET_HEADER = "x-nakafa-mcp-edge-secret";
const MCP_ORIGIN_PATH = "/internal/mcp";

const ApiEdgeContractSchema = Schema.Struct({
  documentPath: Schema.Literal(API_DOCUMENT_PATH),
  originEnvironment: Schema.Literal(AGENT_ORIGIN_ENVIRONMENT),
  originPath: Schema.Literal(API_ORIGIN_PATH),
  publicPath: Schema.Literal(API_PUBLIC_PATH),
  runtimePath: Schema.Literal(API_RUNTIME_PATH),
  secretEnvironment: Schema.Literal(API_EDGE_SECRET_ENVIRONMENT),
  secretHeader: Schema.Literal(API_EDGE_SECRET_HEADER),
});
const McpEdgeContractSchema = Schema.Struct({
  originEnvironment: Schema.Literal(AGENT_ORIGIN_ENVIRONMENT),
  originPath: Schema.Literal(MCP_ORIGIN_PATH),
  secretEnvironment: Schema.Literal(MCP_EDGE_SECRET_ENVIRONMENT),
  secretHeader: Schema.Literal(MCP_EDGE_SECRET_HEADER),
});

export type AgentEdgeContract =
  | typeof ApiEdgeContractSchema.Type
  | typeof McpEdgeContractSchema.Type;

/** Server-only contract shared by the Vercel bridge and Convex origin. */
export const NAKAFA_API_EDGE_CONTRACT: typeof ApiEdgeContractSchema.Type = {
  documentPath: API_DOCUMENT_PATH,
  originEnvironment: AGENT_ORIGIN_ENVIRONMENT,
  originPath: API_ORIGIN_PATH,
  publicPath: API_PUBLIC_PATH,
  runtimePath: API_RUNTIME_PATH,
  secretEnvironment: API_EDGE_SECRET_ENVIRONMENT,
  secretHeader: API_EDGE_SECRET_HEADER,
};

/** Server-only MCP contract shared by its Vercel bridge and Convex origin. */
export const NAKAFA_MCP_EDGE_CONTRACT: typeof McpEdgeContractSchema.Type = {
  originEnvironment: AGENT_ORIGIN_ENVIRONMENT,
  originPath: MCP_ORIGIN_PATH,
  secretEnvironment: MCP_EDGE_SECRET_ENVIRONMENT,
  secretHeader: MCP_EDGE_SECRET_HEADER,
};

/** Optional exact browser origins allowed to call the MCP transport. */
export const NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT =
  "NAKAFA_MCP_ALLOWED_ORIGINS";

/** Owned production browser origins accepted without extra configuration. */
export const NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS = [
  "https://nakafa.com",
  "https://www.nakafa.com",
] as const;

/** Trusted Vercel-provided client address used for pseudonymous quotas. */
export const NAKAFA_EDGE_CLIENT_IP_HEADER = "x-forwarded-for";

/** Public deployment identity attached by each canonical Vercel bridge. */
export const NAKAFA_EDGE_RELEASE_SHA_HEADER = "x-nakafa-release-sha";

/** Vercel system identity for the Git commit that produced a deployment. */
export const VERCEL_GIT_COMMIT_SHA_ENVIRONMENT = "VERCEL_GIT_COMMIT_SHA";

/** Projects one protected origin path back to its public API path. */
export function projectPublicApiPath(pathname: string) {
  const originPath = pathname.slice(NAKAFA_API_EDGE_CONTRACT.originPath.length);
  if (originPath === NAKAFA_API_EDGE_CONTRACT.runtimePath) {
    return NAKAFA_API_EDGE_CONTRACT.publicPath;
  }
  if (originPath.startsWith(`${NAKAFA_API_EDGE_CONTRACT.runtimePath}/`)) {
    return `${NAKAFA_API_EDGE_CONTRACT.publicPath}${originPath.slice(NAKAFA_API_EDGE_CONTRACT.runtimePath.length)}`;
  }
  return originPath || "/";
}
