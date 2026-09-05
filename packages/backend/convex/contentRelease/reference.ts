import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readContentReference } from "@repo/backend/content/reference/read";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { query } from "@repo/backend/convex/_generated/server";
import {
  contentReferenceInputValidator,
  contentReferenceReturnValidator,
} from "@repo/backend/convex/contentRelease/reference/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect, Layer } from "effect";

/** Resolves one current public identity across active signed content families. */
export const read = query({
  args: { input: contentReferenceInputValidator },
  returns: contentReferenceReturnValidator,
  handler: (ctx, { input }) =>
    runConvexProgram(
      readContentReference(input).pipe(
        Effect.provide(
          Layer.mergeAll(
            convexArticleLayer(ctx),
            convexMaterialLayer(ctx),
            convexQuranLayer(ctx),
            convexTryoutLayer(ctx)
          )
        )
      )
    ),
});
