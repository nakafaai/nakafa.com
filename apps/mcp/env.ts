import {
  agentDeploymentKeys,
  agentOriginKeys,
  mcpEdgeKeys,
} from "@repo/backend/keys";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  extends: [agentDeploymentKeys(), agentOriginKeys(), mcpEdgeKeys()],
  runtimeEnv: {},
});
