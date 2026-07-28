import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { cleanupUserAssessmentData } from "@repo/backend/convex/auth/cleanup/assessments";
import { cleanupUserLearningData } from "@repo/backend/convex/auth/cleanup/learning";
import { cleanupUserNotifications } from "@repo/backend/convex/auth/cleanup/notifications";
import { cleanupUserSchoolCommunity } from "@repo/backend/convex/auth/cleanup/schoolCommunity";
import { cleanupUserSchoolData } from "@repo/backend/convex/auth/cleanup/schools";
import { cleanupUserSocialData } from "@repo/backend/convex/auth/cleanup/social";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { cleanupFinalizedAccountDeletion } from "@repo/backend/convex/auth/deletion/cancel";
import { Effect } from "effect";

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

  if (yield* cleanupFinalizedAccountDeletion(ctx, userId)) {
    return true;
  }

  return false;
});
