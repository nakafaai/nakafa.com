/** Builds the one canonical non-personal profile retained by shared records. */
import { DEFAULT_USER_PLAN } from "@repo/backend/confect/credits/constants";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
/** Builds the one canonical non-personal profile retained by shared records. */
export function createDeletedUserTombstone(
  userId: Id<"users">,
  deletedAt: number
) {
  const anonymousId = String(userId);
  return {
    authVerificationCleanupCursor: undefined,
    authId: `deleted:${anonymousId}`,
    credits: 0,
    creditsResetAt: 0,
    deletedAt,
    deletionPreparedAt: undefined,
    email: `deleted-${anonymousId}@account.nakafa.invalid`,
    image: undefined,
    name: "Deleted user",
    plan: DEFAULT_USER_PLAN,
    role: undefined,
  };
}
