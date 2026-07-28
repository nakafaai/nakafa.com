import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DEFAULT_USER_PLAN } from "@repo/backend/convex/credits/constants";

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
    welcomeEmailId: undefined,
  };
}
