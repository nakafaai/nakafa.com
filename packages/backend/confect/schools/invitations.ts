import { InvitationError } from "@repo/backend/confect/schools/invitations/spec";
import { Clock, Effect } from "effect";
/** Validate one invite code's enabled, expiry, and usage-limit state. */
export const validateInviteCodeState = Effect.fn(
  "schools.invitations.validateInviteCodeState"
)(function* ({
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
    return yield* new InvitationError({
      code: "CODE_DISABLED",
      message: "This invite code has been disabled.",
    });
  }
  if (expiresAt !== undefined && expiresAt < (yield* Clock.currentTimeMillis)) {
    return yield* new InvitationError({
      code: "CODE_EXPIRED",
      message: "This invite code has expired.",
    });
  }
  if (maxUsage !== undefined && currentUsage >= maxUsage) {
    return yield* new InvitationError({
      code: "CODE_LIMIT_REACHED",
      message: "This invite code has reached its usage limit.",
    });
  }
});

/** Reject duplicate membership joins with an entity-specific message. */
export const validateNotExistingMembership = Effect.fn(
  "schools.invitations.validateNotExistingMembership"
)(function* (membership: object | null, entityName: "class" | "school") {
  if (!membership) {
    return;
  }
  return yield* new InvitationError({
    code: "ALREADY_MEMBER",
    message: `You are already a member of this ${entityName}.`,
  });
});
