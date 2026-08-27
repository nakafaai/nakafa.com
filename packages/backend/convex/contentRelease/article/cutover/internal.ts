import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import {
  readArticleDateCutover,
  removeLegacyArticleDates,
  restoreLegacyArticleDates,
} from "@repo/backend/convex/contentRelease/article/cutover/model";
import {
  articleDateCutoverReceiptValidator,
  articleDateCutoverRequestValidator,
  articleDateCutoverStatusValidator,
} from "@repo/backend/convex/contentRelease/article/cutover/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Inspects the identity-bound article date transition state. */
export const status = internalQuery({
  args: articleDateCutoverRequestValidator.fields,
  returns: articleDateCutoverStatusValidator,
  handler: (ctx, args) => runConvexProgram(readArticleDateCutover(ctx, args)),
});

/** Removes every verified bridge date in one bounded transaction. */
export const removeLegacyDate = internalMutation({
  args: articleDateCutoverRequestValidator.fields,
  returns: articleDateCutoverReceiptValidator,
  handler: (ctx, args) => runConvexProgram(removeLegacyArticleDates(ctx, args)),
});

/** Restores bridge dates only while the strict cutover is reversible. */
export const restoreLegacyDate = internalMutation({
  args: articleDateCutoverRequestValidator.fields,
  returns: articleDateCutoverReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(restoreLegacyArticleDates(ctx, args)),
});
