import {
  type AgentEdgeContract,
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { createRoutes, deploymentEnv } from "@vercel/config/v1";

interface AgentEdgePath {
  readonly source: string;
  readonly suffix: string;
}

interface AgentEdgeRouteOptions {
  readonly contract: AgentEdgeContract;
  readonly paths: readonly AgentEdgePath[];
}

/** Versioned public API paths and their stable protected-runtime destinations. */
export const NAKAFA_API_EDGE_PATHS = [
  {
    source: `^${NAKAFA_API_EDGE_CONTRACT.discoveryPath.replaceAll(".", "\\.")}$`,
    suffix: NAKAFA_API_EDGE_CONTRACT.documentPath,
  },
  {
    source: `^${NAKAFA_API_EDGE_CONTRACT.publicPath}$`,
    suffix: NAKAFA_API_EDGE_CONTRACT.runtimePath,
  },
  {
    source: `^${NAKAFA_API_EDGE_CONTRACT.publicPath}/(.*)$`,
    suffix: `${NAKAFA_API_EDGE_CONTRACT.runtimePath}/$1`,
  },
] as const;

/** Builds credential-stripping Vercel routes into one protected Convex runtime. */
export function createAgentEdgeRoutes({
  contract,
  paths,
}: AgentEdgeRouteOptions) {
  const routes = createRoutes();

  for (const path of paths) {
    routes.route({
      src: path.source,
      dest: `${deploymentEnv(contract.originEnvironment)}${contract.originPath}${path.suffix}`,
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
  }

  return routes.getConfig();
}
