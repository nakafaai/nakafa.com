import { api as convexApi } from "@repo/backend/convex/_generated/api";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
} from "@/lib/mcp/result";

export const NakafaSearchContentToolInputSchema =
  NakafaAgentSearchOptionsSchema;
export const NakafaSearchContentToolOutputSchema =
  NakafaAgentSearchResultSchema;

/** Builds a search tool result from untrusted MCP arguments. */
export function getNakafaSearchContentToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* decodeNakafaMcpToolInput(
      NakafaSearchContentToolInputSchema,
      args,
      "Invalid Nakafa content search options."
    );
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
