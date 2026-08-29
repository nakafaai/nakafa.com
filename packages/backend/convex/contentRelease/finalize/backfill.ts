import { internalMutation } from "@repo/backend/convex/_generated/server";
import { backfillRuntimeAttempts } from "@repo/backend/convex/contentRelease/finalize/impl";
import {
  finalizationBackfillArgsValidator,
  finalizationReceiptValidator,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import {
  decodeRendererJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/** Internal transaction called only after Node verifies the signed asset. */
export const backfill = internalMutation({
  args: finalizationBackfillArgsValidator,
  returns: finalizationReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const [bundle, renderer] = yield* Effect.all([
          decodeTryoutRuntimeBundleJson(args.bundleJson),
          decodeRendererJson(args.rendererJson),
        ]);
        return yield* backfillRuntimeAttempts(
          ctx,
          bundle,
          renderer,
          args.targetProofHash
        );
      })
    ),
});
