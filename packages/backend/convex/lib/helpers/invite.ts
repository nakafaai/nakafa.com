import { ConvexError } from "convex/values";

/** Validate one invite code's enabled, expiry, and usage-limit state. */
export function validateInviteCodeState({
  currentUsage,
  enabled,
  expiresAt,
  maxUsage,
}: {
  currentUsage: number;
  enabled: boolean;
  expiresAt?: number;
  maxUsage?: number;
}) {
  if (!enabled) {
    throw new ConvexError({
      code: "CODE_DISABLED",
      message: "This invite code has been disabled.",
    });
  }

  if (expiresAt && expiresAt < Date.now()) {
    throw new ConvexError({
      code: "CODE_EXPIRED",
      message: "This invite code has expired.",
    });
  }

  if (maxUsage && currentUsage >= maxUsage) {
    throw new ConvexError({
      code: "CODE_LIMIT_REACHED",
      message: "This invite code has reached its usage limit.",
    });
  }
}

/** Reject duplicate membership joins with an entity-specific message. */
export function validateNotExistingMembership(
  membership: object | null,
  entityName: "class" | "school"
) {
  if (!membership) {
    return;
  }

  throw new ConvexError({
    code: "ALREADY_MEMBER",
    message: `You are already a member of this ${entityName}.`,
  });
}
