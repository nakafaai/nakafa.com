import {
  type AgentEdgeContract,
  NAKAFA_API_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import { Array as Arr, Option, Schema } from "effect";

/** One public request path and the suffix that it rewrites to under the protected origin path. */
const AgentEdgePathSchema = Schema.Struct({
  source: Schema.String,
  suffix: Schema.String,
});
export type AgentEdgePath = typeof AgentEdgePathSchema.Type;

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
] as const satisfies readonly AgentEdgePath[];

/** The public MCP transport path and its protected-transport destination. */
export const NAKAFA_MCP_EDGE_PATHS = [
  {
    source: "^/mcp$",
    suffix: "",
  },
] as const satisfies readonly AgentEdgePath[];

/**
 * The protected origin URL path for one public path, or undefined when no
 * declared path owns it. The first declared path that matches wins.
 */
export function agentEdgeOriginPath(
  contract: AgentEdgeContract,
  paths: readonly AgentEdgePath[],
  pathname: string
): string | undefined {
  const match = Arr.findFirst(paths, ({ source }) =>
    new RegExp(source, "u").test(pathname)
  );
  return Option.getOrUndefined(
    Option.map(
      match,
      ({ source, suffix }) =>
        `${contract.originPath}${pathname.replace(new RegExp(source, "u"), suffix)}`
    )
  );
}

/**
 * The headers that the protected origin receives. Browser credentials never
 * reach it, and the edge secret replaces whatever the caller sent.
 */
export function agentEdgeRequestHeaders(
  headers: Headers,
  contract: AgentEdgeContract,
  secret: string
): Headers {
  const forwarded = new Headers(headers);
  forwarded.delete("authorization");
  forwarded.delete("cookie");
  forwarded.set(contract.secretHeader, secret);
  return forwarded;
}
