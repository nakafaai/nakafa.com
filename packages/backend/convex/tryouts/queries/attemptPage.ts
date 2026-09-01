import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  readSectionAttemptPage,
  readSetAttemptPage,
} from "@repo/backend/convex/tryouts/attemptPage/impl";
import {
  tryoutSectionAttemptPageRequestValidator,
  tryoutSectionAttemptPageResultValidator,
  tryoutSetAttemptPageRequestValidator,
  tryoutSetAttemptPageResultValidator,
} from "@repo/backend/convex/tryouts/attemptPage/spec";

/** Fetches one current set overlay or exact frozen set page. */
export const getSet = query({
  args: {
    request: tryoutSetAttemptPageRequestValidator,
  },
  returns: tryoutSetAttemptPageResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(readSetAttemptPage(ctx, args.request)),
});

/** Fetches one current section redirect or exact frozen section page. */
export const getSection = query({
  args: {
    request: tryoutSectionAttemptPageRequestValidator,
  },
  returns: tryoutSectionAttemptPageResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(readSectionAttemptPage(ctx, args.request)),
});
