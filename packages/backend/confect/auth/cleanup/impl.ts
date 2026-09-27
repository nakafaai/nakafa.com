import { cleanupUserConsents } from "@repo/backend/confect/auth/cleanup/consents";
import { cleanupUserLearningData } from "@repo/backend/confect/auth/cleanup/learning";
import { cleanupUserSchoolCommunity } from "@repo/backend/confect/auth/cleanup/schoolCommunity";
import { cleanupUserSchoolData } from "@repo/backend/confect/auth/cleanup/schools";
import { cleanupUserSocialData } from "@repo/backend/confect/auth/cleanup/social";
import { cleanupUserTryouts } from "@repo/backend/confect/auth/cleanup/tryouts";
import { cleanupFinalizedAccountDeletion } from "@repo/backend/confect/auth/deletion/cancel";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Deletes one bounded batch of personal data. Shared school records keep the
 * stable user ID, so the final pass replaces profile fields with an anonymous
 * tombstone instead of leaving dangling references.
 */
export const cleanupDeletedUserProgram = Effect.fn(
  "auth.cleanup.cleanupDeletedUser"
)(function* (userId: Id<"users">) {
  if (yield* cleanupUserTryouts(userId)) {
    return true;
  }
  if (yield* cleanupUserSchoolCommunity(userId)) {
    return true;
  }
  if (yield* cleanupUserSchoolData(userId)) {
    return true;
  }
  if (yield* cleanupUserSocialData(userId)) {
    return true;
  }
  if (yield* cleanupUserLearningData(userId)) {
    return true;
  }
  if (yield* cleanupUserConsents(userId)) {
    return true;
  }
  if (yield* cleanupFinalizedAccountDeletion(userId)) {
    return true;
  }
  return false;
});
