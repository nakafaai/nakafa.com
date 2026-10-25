import { Config } from "effect";

/**
 * The bindings of an edge Worker that forwards to the Convex origin. Alchemy
 * reads each Config at deploy time and binds the server values as secrets. The
 * release SHA names the commit that the workflow deploys.
 */
export const edgeWorkerBindings = (
  secretEnvironment: "NAKAFA_API_EDGE_SECRET" | "NAKAFA_MCP_EDGE_SECRET"
) => ({
  CONVEX_SITE_URL: Config.String("CONVEX_SITE_URL"),
  NAKAFA_RELEASE_SHA: Config.String("NAKAFA_RELEASE_SHA"),
  [secretEnvironment]: Config.Redacted(secretEnvironment),
});
