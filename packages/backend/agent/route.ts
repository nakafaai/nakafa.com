import { createRoutes, deploymentEnv } from "@vercel/config/v1";
import type { AgentEdgeContract } from "./edge.ts";
import {
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "./edge.ts";

interface AgentEdgeRouteOptions {
  readonly contract: AgentEdgeContract;
  readonly source: string;
  readonly suffix: string;
}

/** Builds one credential-stripping Vercel route into a protected Convex runtime. */
export function createAgentEdgeRoute({
  contract,
  source,
  suffix,
}: AgentEdgeRouteOptions) {
  const routes = createRoutes();

  routes.route({
    src: source,
    dest: `${deploymentEnv(contract.originEnvironment)}${contract.originPath}${suffix}`,
    env: [contract.originEnvironment],
    respectOriginCacheControl: false,
    transforms: [
      {
        type: "request.headers",
        op: "delete",
        target: { key: "authorization" },
      },
      {
        type: "request.headers",
        op: "delete",
        target: { key: "cookie" },
      },
      {
        type: "request.headers",
        op: "delete",
        target: { key: contract.secretHeader },
      },
      {
        type: "request.headers",
        op: "set",
        target: { key: contract.secretHeader },
        args: deploymentEnv(contract.secretEnvironment),
        env: [contract.secretEnvironment],
      },
      {
        type: "response.headers",
        op: "set",
        target: { key: NAKAFA_EDGE_RELEASE_SHA_HEADER },
        args: deploymentEnv(VERCEL_GIT_COMMIT_SHA_ENVIRONMENT),
        env: [VERCEL_GIT_COMMIT_SHA_ENVIRONMENT],
      },
    ],
  });

  return routes.getConfig();
}
