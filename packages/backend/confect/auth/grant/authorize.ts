import {
  DatabaseReader,
  DatabaseWriter,
  DocumentIds,
} from "@repo/backend/confect/_generated/services";
import { AgentRefused } from "@repo/backend/confect/auth/grant/schema";
import { CODE_LIFETIME } from "@repo/backend/confect/auth/grant/token";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { issueToken } from "@repo/utilities/token";
import { Array as Arr, Clock, Duration, Effect, Option } from "effect";

/** A PKCE challenge of method S256: the Base64Url of a SHA-256, 43 characters (RFC 7636). */
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/u;

/** The registered agent that a `client_id` names, if any. */
export const readAgentClient = Effect.fn("auth.grant.client")(function* (
  clientId: string
) {
  const id = yield* (yield* DocumentIds).parse("agentClients", clientId);
  if (Option.isNone(id)) {
    return Option.none();
  }
  return yield* (yield* DatabaseReader)
    .table("agentClients")
    .get(id.value)
    .pipe(Effect.option);
});

/**
 * What the consent page shows of an agent: the name it gave, and the host its
 * first redirect address names, so the person sees where the code goes.
 */
export const describeAgent = Effect.fn("auth.grant.describe")(function* (
  clientId: string
) {
  const client = yield* readAgentClient(clientId);
  return Option.match(client, {
    onNone: () => null,
    onSome: ({ name, redirectUris }) => ({
      name,
      redirect: new URL(Arr.headNonEmpty(redirectUris)).host || null,
    }),
  });
});

/**
 * The person's answer on the consent page: an authorization code for the agent,
 * bound to the redirect address the agent registered and to its PKCE challenge,
 * which the agent trades once within `CODE_LIFETIME`. Only its hash is kept.
 */
export const authorizeAgent = Effect.fn("auth.grant.authorize")(function* (args: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeChallenge: string;
}) {
  const { appUser } = yield* requireAuth();
  const client = yield* readAgentClient(args.clientId);
  if (Option.isNone(client)) {
    return yield* new AgentRefused({
      error: "invalid_client",
      error_description: "No agent is registered with this client_id.",
    });
  }
  if (!Arr.contains(client.value.redirectUris, args.redirectUri)) {
    return yield* new AgentRefused({
      error: "invalid_redirect_uri",
      error_description: "The redirect_uri is not one the agent registered.",
    });
  }
  if (!S256_CHALLENGE.test(args.codeChallenge)) {
    return yield* new AgentRefused({
      error: "invalid_request",
      error_description: "An S256 code_challenge is required.",
    });
  }
  const { hash, token } = yield* issueToken();
  const now = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("agentCodes")
    .insert({
      clientId: client.value._id,
      userId: appUser._id,
      codeHash: hash,
      codeChallenge: args.codeChallenge,
      redirectUri: args.redirectUri,
      expiresAt: now + Duration.toMillis(CODE_LIFETIME),
    })
    .pipe(Effect.orDie);
  return { code: token };
});
