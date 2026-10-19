import { cleanupUserConnections } from "@repo/backend/confect/auth/cleanup/connections";
import { cleanupUserConsents } from "@repo/backend/confect/auth/cleanup/consents";
import { cleanupUserJournal } from "@repo/backend/confect/auth/cleanup/journal";
import { cleanupUserLearningData } from "@repo/backend/confect/auth/cleanup/learning";
import { cleanupUserSocialData } from "@repo/backend/confect/auth/cleanup/social";
import { cleanupUserTryouts } from "@repo/backend/confect/auth/cleanup/tryouts";
import { cleanupFinalizedAccountDeletion } from "@repo/backend/confect/auth/deletion/cancel";
import { shredLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Deletes one bounded batch of personal data and says whether it found any, so
 * the caller runs it again until it finds none. It never deletes the user row:
 * finalizing the deletion already replaced the profile fields with an
 * anonymous tombstone, so a record that keeps the stable user ID names no one.
 */
export const cleanupDeletedUserProgram = Effect.fn(
  "auth.cleanup.cleanupDeletedUser"
)(function* (userId: Id<"users">) {
  if (yield* cleanupUserTryouts(userId)) {
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
  if (yield* cleanupUserConnections(userId)) {
    return true;
  }
  if (yield* cleanupUserJournal(userId)) {
    return true;
  }
  // The vault key goes after every row it sealed, so nothing is left to open.
  if (yield* shredLearnerKeys(userId)) {
    return true;
  }
  if (yield* cleanupFinalizedAccountDeletion(userId)) {
    return true;
  }
  return false;
});
