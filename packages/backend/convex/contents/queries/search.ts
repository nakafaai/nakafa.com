import { query } from "@repo/backend/convex/_generated/server";
import { validateContentSearchInput } from "@repo/backend/convex/contents/helpers/search/input";
import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import { buildContentSearchResult } from "@repo/backend/convex/contents/helpers/search/result";
import {
  contentSearchInputValidator,
  contentSearchResultValidator,
} from "@repo/backend/convex/contents/helpers/search/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/**
 * Searches synced content with stable section-aware relevance ordering.
 *
 * References:
 * - Convex full-text search:
 *   https://docs.convex.dev/search/text-search
 * - Convex bounded query guidance:
 *   https://docs.convex.dev/understanding/best-practices/
 */
export const search = query({
  args: contentSearchInputValidator,
  returns: contentSearchResultValidator,
  /** Runs a bounded section-aware search over the durable content read model. */
  handler: (ctx, args) => {
    const queryTexts = validateContentSearchInput(args);
    const scanLimit = args.offset + args.limit + 1;
    return runConvexProgram(
      readContentSearchDocuments(ctx, args, queryTexts, scanLimit).pipe(
        Effect.map((documents) =>
          buildContentSearchResult(args, documents, queryTexts)
        )
      )
    );
  },
});
