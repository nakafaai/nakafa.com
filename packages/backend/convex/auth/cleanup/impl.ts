import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { cleanupUserAssessmentData } from "@repo/backend/convex/auth/cleanup/assessments";
import { cleanupUserLearningData } from "@repo/backend/convex/auth/cleanup/learning";
import { cleanupUserNotifications } from "@repo/backend/convex/auth/cleanup/notifications";
import { cleanupUserSchoolCommunity } from "@repo/backend/convex/auth/cleanup/schoolCommunity";
import { cleanupUserSchoolData } from "@repo/backend/convex/auth/cleanup/schools";
import { cleanupUserSocialData } from "@repo/backend/convex/auth/cleanup/social";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { Clock, Effect } from "effect";

/**
 * Deletes one bounded batch of personal data. Shared school records keep the
 * stable user ID, so the final pass replaces profile fields with an anonymous
 * tombstone instead of leaving dangling references.
 */
export const cleanupDeletedUserProgram = Effect.fn(
  "auth.cleanup.cleanupDeletedUser"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupUserNotifications(ctx, userId)) {
    return true;
  }

  if (yield* cleanupUserTryouts(ctx, userId)) {
    return true;
  }

  if (yield* cleanupUserAssessmentData(ctx, userId)) {
    return true;
  }

  if (yield* cleanupUserSchoolCommunity(ctx, userId)) {
    return true;
  }

  if (yield* cleanupUserSchoolData(ctx, userId)) {
    return true;
  }

  if (yield* cleanupUserSocialData(ctx, userId)) {
    return true;
  }

  if (yield* cleanupUserLearningData(ctx, userId)) {
    return true;
  }

  const user = yield* tryUserCleanup(() => ctx.db.get("users", userId));

  if (user) {
    const deletedAt = user.deletedAt ?? (yield* Clock.currentTimeMillis);
    const anonymousId = String(userId);

    yield* tryUserCleanup(() =>
      ctx.db.patch("users", userId, {
        authId: `deleted:${anonymousId}`,
        credits: 0,
        creditsResetAt: 0,
        deletedAt,
        email: `deleted-${anonymousId}@account.nakafa.invalid`,
        image: undefined,
        name: "Deleted user",
        plan: "free",
        role: undefined,
      })
    );
  }

  return false;
});
