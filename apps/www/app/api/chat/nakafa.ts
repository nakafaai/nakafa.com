import type { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import refs from "@repo/backend/confect/_generated/refs";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { fetchQuery } from "convex/nextjs";
import type { Context } from "effect";
import { Effect } from "effect";

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
      try: () =>
        fetchQuery(
          toConvexReference(refs.public.contents.queries.search.search),
          input
        ),
      catch: (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "Unable to search Nakafa content.",
        }),
    }),
} satisfies Context.Tag.Service<typeof NakafaSearch>;
