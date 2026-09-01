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
import {
  observeTryoutResponseContract,
  tryoutResponseContractValidator,
} from "@repo/backend/convex/tryouts/response/contract";

/** Fetches one current set overlay or exact frozen set page. */
export const getSet = query({
  args: {
    request: tryoutSetAttemptPageRequestValidator,
    responseContract: tryoutResponseContractValidator,
  },
  returns: tryoutSetAttemptPageResultValidator,
  handler: async (ctx, args) => {
    const result = await runConvexProgram(
      readSetAttemptPage(ctx, args.request)
    );
    if (result) {
      observeTryoutResponseContract(args.responseContract);
    }
    return result;
  },
});

/** Fetches one current section redirect or exact frozen section page. */
export const getSection = query({
  args: {
    request: tryoutSectionAttemptPageRequestValidator,
    responseContract: tryoutResponseContractValidator,
  },
  returns: tryoutSectionAttemptPageResultValidator,
  handler: async (ctx, args) => {
    const result = await runConvexProgram(
      readSectionAttemptPage(ctx, args.request)
    );
    if (result) {
      observeTryoutResponseContract(args.responseContract);
    }
    return result;
  },
});
