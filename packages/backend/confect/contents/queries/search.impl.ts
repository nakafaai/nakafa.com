import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contents/queries/search.spec";
import { validateContentSearchInput } from "@repo/backend/confect/contents/search/input";
import { readContentSearchDocuments } from "@repo/backend/confect/contents/search/read";
import { buildContentSearchResult } from "@repo/backend/confect/contents/search/result";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/agent/search";
import { Effect, Layer } from "effect";

/**
 * Searches synced content with stable section-aware relevance ordering.
 *
 * References:
 * - Convex full-text search:
 *   https://docs.convex.dev/search/text-search
 * - Convex bounded query guidance:
 *   https://docs.convex.dev/understanding/best-practices/
 */
const search = FunctionImpl.make(
  databaseSchema,
  spec,
  "search",
  Effect.fn("contents.queries.search.search")(function* (args) {
    const queryTexts = yield* validateContentSearchInput(args);
    const scanLimit = Math.min(
      args.offset + args.limit + 1,
      NAKAFA_AGENT_SEARCH_WINDOW
    );
    return yield* readContentSearchDocuments(args, queryTexts, scanLimit).pipe(
      Effect.map((documents) =>
        buildContentSearchResult(args, documents, queryTexts)
      )
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(search),
  GroupImpl.finalize
);
