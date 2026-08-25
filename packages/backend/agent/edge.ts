import { Schema } from "effect";

export const AgentEdgeSurfaceSchema = Schema.Literals(["api", "mcp"]);
export type AgentEdgeSurface = typeof AgentEdgeSurfaceSchema.Type;

const API_EDGE_SECRET_ENVIRONMENT = "NAKAFA_API_EDGE_SECRET";
const API_EDGE_SECRET_HEADER = "x-nakafa-api-edge-secret";
const MCP_EDGE_SECRET_ENVIRONMENT = "NAKAFA_MCP_EDGE_SECRET";
const MCP_EDGE_SECRET_HEADER = "x-nakafa-mcp-edge-secret";
const ApiEdgeContractSchema = Schema.Struct({
  secretEnvironment: Schema.Literal(API_EDGE_SECRET_ENVIRONMENT),
  secretHeader: Schema.Literal(API_EDGE_SECRET_HEADER),
  surface: Schema.Literal("api"),
});
const McpEdgeContractSchema = Schema.Struct({
  secretEnvironment: Schema.Literal(MCP_EDGE_SECRET_ENVIRONMENT),
  secretHeader: Schema.Literal(MCP_EDGE_SECRET_HEADER),
  surface: Schema.Literal("mcp"),
});

export type AgentEdgeContract =
  | typeof ApiEdgeContractSchema.Type
  | typeof McpEdgeContractSchema.Type;

export const NAKAFA_API_EDGE_CONTRACT: typeof ApiEdgeContractSchema.Type = {
  secretEnvironment: API_EDGE_SECRET_ENVIRONMENT,
  secretHeader: API_EDGE_SECRET_HEADER,
  surface: "api",
};
export const NAKAFA_MCP_EDGE_CONTRACT: typeof McpEdgeContractSchema.Type = {
  secretEnvironment: MCP_EDGE_SECRET_ENVIRONMENT,
  secretHeader: MCP_EDGE_SECRET_HEADER,
  surface: "mcp",
};

export const NAKAFA_CONVEX_SITE_URL_ENVIRONMENT = "NAKAFA_CONVEX_SITE_URL";
export const NAKAFA_EDGE_CLIENT_IP_HEADER = "x-forwarded-for";
export const NAKAFA_EDGE_RELEASE_SHA_HEADER = "x-nakafa-release-sha";
export const NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT =
  "NAKAFA_MCP_ALLOWED_ORIGINS";
export const NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS = Object.freeze([
  "https://nakafa.com",
  "https://www.nakafa.com",
]);
export const VERCEL_REWRITE_CACHE_CONTROL_HEADER =
  "x-vercel-enable-rewrite-caching";
export const VERCEL_GIT_COMMIT_SHA_ENVIRONMENT = "VERCEL_GIT_COMMIT_SHA";

/** Returns the exact secret environment and header pair for one edge surface. */
export function getAgentEdgeContract(surface: AgentEdgeSurface) {
  if (surface === "api") {
    return NAKAFA_API_EDGE_CONTRACT;
  }
  return NAKAFA_MCP_EDGE_CONTRACT;
}
