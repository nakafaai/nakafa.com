import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { api as convexApi } from "@repo/backend/confect/_generated/functionReferences";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
} from "@/lib/mcp/result";
import {
  NakafaSearchContentInputSchema,
  NakafaSearchContentOutputSchema,
} from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the content search tool. */
export function registerNakafaSearchContentTool(server: McpServer) {
  server.registerTool(
    "nakafa_search_content",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Search the Nakafa public content index across articles, subjects, exercises, and Quran references. Returns bounded paginated summaries with stable content IDs.",
      inputSchema: NakafaSearchContentInputSchema,
      outputSchema: NakafaSearchContentOutputSchema,
      title: "Search Nakafa Content",
    },
    (args) => Effect.runPromise(getNakafaSearchContentToolResult(args))
  );
}

/** Builds a search tool result from untrusted MCP arguments. */
export function getNakafaSearchContentToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* Effect.try({
      try: () => NakafaSearchContentInputSchema.parse(args),
      catch: (error) =>
        new NakafaAgentInputError({
          cause: getUnknownErrorMessage(error),
          message: "Invalid Nakafa content search options.",
        }),
    });
    const result = yield* Effect.tryPromise({
      try: () => fetchQuery(convexApi.contents.queries.search.search, input),
      catch: (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "Unable to search Nakafa content.",
        }),
    });

    return toMcpStructuredResult(result);
  }).pipe(
    Effect.catchTags({
      NakafaAgentDataReadError: succeedMcpReadModelError,
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
