import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import {
  protectedArgsValidator,
  protectedResultValidator,
  readProtectedProgram,
} from "@repo/backend/content/tryout/protected";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";
/** Returns one ordered protected batch from a permanent runtime bundle. */
export const read = internalQuery({
  args: protectedArgsValidator,
  returns: protectedResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readProtectedProgram(args).pipe(Effect.provide(convexTryoutLayer(ctx)))
    ),
});
