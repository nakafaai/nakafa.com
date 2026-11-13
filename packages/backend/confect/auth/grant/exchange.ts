import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { readAgentClient } from "@repo/backend/confect/auth/grant/authorize";
import { AgentRefused } from "@repo/backend/confect/auth/grant/schema";
import {
  GRANT_LIFETIME,
  signAgentToken,
  tokenAnswer,
} from "@repo/backend/confect/auth/grant/token";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { sha256, sha256Hex } from "@repo/utilities/digest";
import { issueToken } from "@repo/utilities/token";
import { Clock, Duration, Effect, Option } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * The one refusal of a code or a refresh token that does not hold, whatever the
 * cause (RFC 6749 section 5.2). It is an answer, not a failure: a failure rolls
 * the transaction back, and a refusal must keep the code it spent and the grant
 * it ended.
 */
const invalidGrant = () => ({
  outcome: "refused" as const,
  error: "invalid_grant" as const,
  error_description: "The grant is invalid, expired, or revoked.",
});

/** The answer of a trade that holds. */
const issued = (accessToken: string, refreshToken: string) => ({
  outcome: "issued" as const,
  tokens: tokenAnswer(accessToken, refreshToken),
});

/** Whether a PKCE verifier matches the challenge the code was bound to (S256, RFC 7636 section 4.6). */
const verifiesChallenge = Effect.fn("auth.grant.pkce")(function* (
  verifier: string,
  challenge: string
) {
  const digest = yield* sha256(new TextEncoder().encode(verifier));
  return Base64Url.encode(digest) === challenge;
});

/** Whether the account still takes an agent: it exists and is not being deleted. */
const isLiveAccount = Effect.fn("auth.grant.live")(function* (
  userId: Id<"users">
) {
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(userId)
    .pipe(Effect.option);
  return Option.isSome(user) && !isAccountDeletionPending(user.value);
});

/**
 * Trades an authorization code for the agent's tokens, once (RFC 6749 section
 * 4.1.3). The code must name this agent and its redirect address, the verifier
 * must match its challenge, and it must be fresh; it is spent whatever the
 * outcome, so a stolen code cannot be tried twice.
 */
export const exchangeCode = Effect.fn("auth.grant.exchange")(function* (args: {
  readonly clientId: string;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
}) {
  const client = yield* readAgentClient(args.clientId);
  if (Option.isNone(client)) {
    return yield* new AgentRefused({
      error: "invalid_client",
      error_description: "No agent is registered with this client_id.",
    });
  }
  const codeHash = yield* sha256Hex(args.code);
  const code = yield* (yield* DatabaseReader)
    .table("agentCodes")
    .index("by_codeHash", (query) => query.eq("codeHash", codeHash))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(code)) {
    return invalidGrant();
  }
  const writer = yield* DatabaseWriter;
  yield* writer.table("agentCodes").delete(code.value._id).pipe(Effect.orDie);
  const now = yield* Clock.currentTimeMillis;
  const holds =
    code.value.clientId === client.value._id &&
    code.value.redirectUri === args.redirectUri &&
    code.value.expiresAt > now &&
    (yield* verifiesChallenge(args.codeVerifier, code.value.codeChallenge)) &&
    (yield* isLiveAccount(code.value.userId));
  if (!holds) {
    return invalidGrant();
  }
  const refresh = yield* issueToken();
  const grantId = yield* writer
    .table("agentGrants")
    .insert({
      clientId: client.value._id,
      userId: code.value.userId,
      refreshHash: refresh.hash,
      refreshedAt: now,
    })
    .pipe(Effect.orDie);
  return issued(yield* signAgentToken(grantId), refresh.token);
});

/**
 * Trades a refresh token for new tokens (RFC 6749 section 6). The refresh token
 * is replaced at every use, so a spent one fails; a grant unused for
 * `GRANT_LIFETIME`, or whose person is gone, ends.
 */
export const refreshGrant = Effect.fn("auth.grant.refresh")(function* (args: {
  readonly clientId: string;
  readonly refreshToken: string;
}) {
  const refreshHash = yield* sha256Hex(args.refreshToken);
  const grant = yield* (yield* DatabaseReader)
    .table("agentGrants")
    .index("by_refreshHash", (query) => query.eq("refreshHash", refreshHash))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(grant) || String(grant.value.clientId) !== args.clientId) {
    return invalidGrant();
  }
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const expired =
    grant.value.refreshedAt + Duration.toMillis(GRANT_LIFETIME) <= now;
  if (expired || !(yield* isLiveAccount(grant.value.userId))) {
    yield* writer.table("agentGrants").delete(grant.value._id).pipe(Effect.orDie);
    return invalidGrant();
  }
  const refresh = yield* issueToken();
  yield* writer
    .table("agentGrants")
    .patch(grant.value._id, { refreshHash: refresh.hash, refreshedAt: now })
    .pipe(Effect.orDie);
  return issued(yield* signAgentToken(grant.value._id), refresh.token);
});
