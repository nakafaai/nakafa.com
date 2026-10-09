import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import { InvitationError } from "@repo/backend/confect/schools/invitations/spec";
import { Clock, Crypto, Effect } from "effect";
import { Base64Url } from "effect/encoding";
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

const INVITE_CODE_LENGTH = 10;
/** Each symbol uses six random bits, so ten symbols need 60 bits from eight bytes. */
const INVITE_CODE_BYTES = Math.ceil((INVITE_CODE_LENGTH * 6) / 8);

/**
 * Generate one invite code: ten URL-safe symbols from the runtime's Web Crypto
 * source. Six bits index the 64-symbol base64url alphabet exactly, so every
 * symbol is uniform. Eight bytes encode to eleven symbols; the eleventh carries
 * only four random bits, so it is cut off.
 */
export const generateInviteCode = Effect.fn(
  "schools.invitations.generateInviteCode"
)(
  function* () {
    const crypto = yield* Crypto.Crypto;
    const bytes = yield* crypto.randomBytes(INVITE_CODE_BYTES);
    return Base64Url.encode(bytes).slice(0, INVITE_CODE_LENGTH);
  },
  Effect.orDie,
  Effect.provide(WebCryptoLayer)
);
