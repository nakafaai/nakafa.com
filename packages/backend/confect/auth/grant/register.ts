import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import {
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { AgentRefused } from "@repo/backend/confect/auth/grant/schema";
import { Array as Arr, Effect } from "effect";

/**
 * The registrations all of Nakafa takes: twenty an hour. An agent registers once per install,
 * and the endpoint takes no credential, so without this anyone could grow the table without end.
 * It is a design choice, not a measurement.
 */
const registrations = new RateLimiter(components.agentRateLimiter, {
  agentRegistration: {
    capacity: 20,
    kind: "token bucket",
    period: HOUR,
    rate: 20,
  },
});

/** The most redirect addresses and the longest name and address one agent may register. */
const MAX_REDIRECTS = 10;
const MAX_NAME_LENGTH = 200;
const MAX_URI_LENGTH = 2048;

/**
 * Whether an address may receive a code: absolute, without a fragment (RFC 6749
 * section 3.1.2). A native agent's loopback or custom scheme passes, as RFC 8252
 * allows, because PKCE binds the code to the agent that asked for it.
 */
const isRedirectUri = (uri: string) =>
  uri.length <= MAX_URI_LENGTH && URL.canParse(uri) && !uri.includes("#");

/**
 * Registers an agent (RFC 7591): a public client, which proves itself with PKCE
 * at every exchange (ADR 0029). Its id is its `client_id`.
 */
export const registerAgent = Effect.fn("auth.grant.register")(function* (args: {
  readonly name: string;
  readonly redirectUris: readonly string[];
}) {
  const ctx = yield* MutationCtx;
  const { ok } = yield* Effect.promise(() =>
    registrations.limit(ctx, "agentRegistration")
  );
  if (!ok) {
    return yield* new AgentRefused({
      error: "slow_down",
      error_description: "Too many agents registered. Try again later.",
    });
  }
  const name = args.name.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return yield* new AgentRefused({
      error: "invalid_client_metadata",
      error_description: "The client name must be 1 to 200 characters.",
    });
  }
  const { redirectUris } = args;
  if (
    !Arr.isReadonlyArrayNonEmpty(redirectUris) ||
    redirectUris.length > MAX_REDIRECTS ||
    !Arr.every(redirectUris, isRedirectUri)
  ) {
    return yield* new AgentRefused({
      error: "invalid_redirect_uri",
      error_description:
        "Register 1 to 10 absolute redirect URIs without a fragment.",
    });
  }
  const clientId = yield* (yield* DatabaseWriter)
    .table("agentClients")
    .insert({ name, redirectUris })
    .pipe(Effect.orDie);
  return { clientId };
});

