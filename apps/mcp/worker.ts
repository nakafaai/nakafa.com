import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { agentEdgeWorker } from "@repo/backend/agent/proxy";
import { NAKAFA_MCP_EDGE_PATHS } from "@repo/backend/agent/route";

/**
 * The public MCP edge. It forwards the MCP transport path to the protected
 * Convex runtime with the MCP edge secret. Every other path answers 404.
 */
export default agentEdgeWorker(NAKAFA_MCP_EDGE_CONTRACT, NAKAFA_MCP_EDGE_PATHS);
