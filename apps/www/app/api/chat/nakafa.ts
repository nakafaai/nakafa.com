import type { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { NakafaAgentSearchResultSchema } from "@repo/contents/_lib/agent/schema/search";
import { fetchQuery } from "convex/nextjs";
import type { Context } from "effect";
import { Effect, Schema } from "effect";

/**
 * Convex-backed Nakafa search adapter for Nina.
 *
 * References:
 * - Convex Next.js server calls:
 *   https://docs.convex.dev/client/nextjs/app-router/server-rendering
 * - Effect Promise boundary:
 *   https://effect.website/docs/getting-started/creating-effects/#trypromise
 */
export const search = {
  search: (input) =>
    Effect.tryPromise({
      try: () => fetchQuery(convexApi.contents.queries.search.search, input),
      catch: (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "Unable to search Nakafa content.",
        }),
    }).pipe(
      Effect.flatMap((result) =>
        Schema.decodeUnknown(NakafaAgentSearchResultSchema)(result).pipe(
          Effect.mapError(
            (error) =>
              new NakafaAgentDataReadError({
                cause: getUnknownErrorMessage(error),
                message: "Unable to validate Nakafa search results.",
              })
          )
        )
      )
    ),
} satisfies Context.Tag.Service<typeof NakafaSearch>;
