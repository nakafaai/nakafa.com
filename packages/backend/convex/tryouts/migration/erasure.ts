import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type AttemptOwner = Pick<Doc<"tryoutAttempts">, "userId">;

/** Detects one temporary signed-migration hold for a user. */
export const hasUserErasureHold = Effect.fn(
  "tryouts.migration.hasUserErasureHold"
)(function* (ctx: ReadCtx, userId: Id<"users">) {
  const audit = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryAttemptMigrationAudits")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .first()
  );
  return audit !== null;
});

/** Detects one temporary signed-migration hold for an attempt. */
export const hasAttemptErasureHold = Effect.fn(
  "tryouts.migration.hasAttemptErasureHold"
)(function* (ctx: ReadCtx, attemptId: Id<"tryoutAttempts">) {
  const audit = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryAttemptMigrationAudits")
      .withIndex("by_tryoutAttemptId", (query) =>
        query.eq("tryoutAttemptId", attemptId)
      )
      .first()
  );
  return audit !== null;
});

/** Refuses authorization while any audited owner is being erased. */
export const requireMigrationUsersAvailable = Effect.fn(
  "tryouts.migration.requireUsersAvailable"
)(function* (
  ctx: ReadCtx,
  entries: readonly { readonly attempt: AttemptOwner }[]
) {
  const userIds = new Set(entries.map(({ attempt }) => attempt.userId));
  for (const userId of userIds) {
    const user = yield* Effect.promise(() => ctx.db.get(userId));
    if (!user || isAccountDeletionPending(user)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Try-out history migration cannot authorize an account under erasure."
      );
    }
  }
});
