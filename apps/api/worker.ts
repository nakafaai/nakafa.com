import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { agentEdgeWorker } from "@repo/backend/agent/proxy";
import { NAKAFA_API_EDGE_PATHS } from "@repo/backend/agent/route";

/**
 * The public API edge. It forwards the versioned API paths to the protected
 * Convex runtime with the edge secret. Every other path answers 404.
 */
export default agentEdgeWorker({
  contract: NAKAFA_API_EDGE_CONTRACT,
  paths: NAKAFA_API_EDGE_PATHS,
});
