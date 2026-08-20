import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import type { MutationCtx } from "@repo/backend/convex/betterAuth/_generated/server";
import { mutation } from "@repo/backend/convex/betterAuth/_generated/server";
import schema from "@repo/backend/convex/betterAuth/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { paginator } from "convex-helpers/server/pagination";
import { Effect, Result, Schema } from "effect";

const oauthLinkVerificationSchema = Schema.fromJsonString(
  Schema.Struct({
    link: Schema.Struct({
      userId: Schema.String,
    }),
  })
);
const decodeOauthLinkVerification = Schema.decodeUnknownResult(
  oauthLinkVerificationSchema
);
/** Matches the direct tokens and OAuth-link state Better Auth owns per user. */
function belongsToDeletedUser(value: string, authId: string) {
  if (value === authId) {
    return true;
  }
  const decoded = decodeOauthLinkVerification(value);
  return Result.isSuccess(decoded) && decoded.success.link.userId === authId;
}
/** Deletes one bounded scan page of Better Auth verification artifacts. */
const deleteUserVerificationPageProgram = Effect.fn(
  "betterAuth.deletion.deleteUserVerificationPage"
)(function* (ctx: MutationCtx, authId: string, cursor: string | null) {
  const page = yield* tryUserCleanup(() =>
    paginator(ctx.db, schema).query("verification").paginate({
      cursor,
      numItems: ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE,
    })
  );
  for (const verification of page.page) {
    if (belongsToDeletedUser(verification.value, authId)) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("verification", verification._id)
      );
    }
  }
  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
  };
});
/**
 * Scans Better Auth verification rows with an opaque cursor because OAuth
 * link state embeds the user ID inside its JSON value and cannot use an index.
 */
export const deleteUserVerificationPage = mutation({
  args: {
    authId: v.string(),
    cursor: v.union(v.null(), v.string()),
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: (ctx, args) =>
    runConvexProgram(
      deleteUserVerificationPageProgram(ctx, args.authId, args.cursor)
    ),
});
