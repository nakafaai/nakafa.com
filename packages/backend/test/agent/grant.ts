import authTest from "@convex-dev/auth/test";
import type { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { sha256 } from "@repo/utilities/digest";
import { Config, Effect } from "effect";
import { Base64Url } from "effect/encoding";

type BackendTest = ReturnType<typeof createConvexTestWithAuth>;

/** The one address the test agent registers. */
export const REDIRECT = "https://agent.example/callback";

/** The PKCE verifier the test agent keeps: 43 or more characters (RFC 7636 section 4.1). */
export const VERIFIER = "the-test-agent-keeps-this-verifier-0123456789";

/** The S256 challenge of a PKCE verifier (RFC 7636 section 4.2). */
export const challengeOf = (verifier: string) =>
  Effect.runPromise(
    sha256(new TextEncoder().encode(verifier)).pipe(Effect.map(Base64Url.encode))
  );

/** Registers the test agent, as its first run does, and answers its `client_id`. */
export async function registerTestAgent(t: BackendTest, name = "Test Agent") {
  const { clientId } = await t.mutation(api.auth.grant.register, {
    name,
    redirectUris: [REDIRECT],
  });
  return clientId;
}

/** The person of `sessionId` lets the agent in on the consent page, which answers a code. */
export async function authorizeTestAgent(
  t: BackendTest,
  sessionId: string,
  clientId: Id<"agentClients">
) {
  const { code } = await t
    .withIdentity({ subject: sessionId })
    .mutation(api.auth.grant.authorize, {
      clientId,
      codeChallenge: await challengeOf(VERIFIER),
      redirectUri: REDIRECT,
    });
  return code;
}

/** Lets the agent in as the person of `sessionId` and trades the code, as the token endpoint does. */
export async function letAgentIn(
  t: BackendTest,
  sessionId: string,
  clientId: Id<"agentClients">
) {
  return await t.mutation(api.auth.grant.exchange, {
    clientId,
    code: await authorizeTestAgent(t, sessionId, clientId),
    codeVerifier: VERIFIER,
    redirectUri: REDIRECT,
  });
}

/**
 * The issuer of every agent token: the deployment's own address, which
 * `vitest.setup.ts` sets as convex-test signs with it.
 */
export const AGENT_ISSUER = Effect.runSync(Config.String("CONVEX_CLOUD_URL"));

/** The identity Convex derives from an agent's access token: the deployment issued it, for its grant. */
export const agentIdentity = (accessToken: string) => ({
  issuer: AGENT_ISSUER,
  subject: authTest.sessionIdentity({ accessToken }).subject,
});
