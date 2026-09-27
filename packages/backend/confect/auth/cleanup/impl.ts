import { cleanupUserConsents } from "@repo/backend/confect/auth/cleanup/consents";
import { cleanupUserLearningData } from "@repo/backend/confect/auth/cleanup/learning";
import { cleanupUserSchoolCommunity } from "@repo/backend/confect/auth/cleanup/schoolCommunity";
import { cleanupUserSchoolData } from "@repo/backend/confect/auth/cleanup/schools";
import { cleanupUserSocialData } from "@repo/backend/confect/auth/cleanup/social";
import { cleanupUserTryouts } from "@repo/backend/confect/auth/cleanup/tryouts";
import { cleanupFinalizedAccountDeletion } from "@repo/backend/confect/auth/deletion/cancel";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/**
 * Deletes one bounded batch of personal data. Shared school records keep the
 * stable user ID, so the final pass replaces profile fields with an anonymous
 * tombstone instead of leaving dangling references.
 */
export const cleanupDeletedUserProgram = Effect.fn(
  "auth.cleanup.cleanupDeletedUser"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  if (yield* cleanupUserTryouts(ctx, userId)) {
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
  if (yield* cleanupUserConsents(ctx, userId)) {
    return true;
  }
  if (yield* cleanupFinalizedAccountDeletion(ctx, userId)) {
    return true;
  }
  return false;
});
