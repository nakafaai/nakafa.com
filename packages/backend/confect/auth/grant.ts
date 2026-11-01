import { ConvexConfigProvider } from "@confect/server";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  type DispatchContext,
} from "better-auth/api";
import type { BetterAuthOptions } from "better-auth/minimal";
import type { GenericActionCtx } from "convex/server";
import {
  Array as Arr,
  Clock,
  Effect,
  Option,
  Schema,
  String as Str,
} from "effect";

/** The path where a person's browser starts an agent's authorization. */
const AUTHORIZE_PATH = "/mcp/authorize";

/** The path where an agent trades a code or a refresh token. */
const TOKEN_PATH = "/mcp/token";

/** The path where an agent registers itself, which takes no credential. */
const REGISTER_PATH = "/mcp/register";

/** The path where the consent page reads which agent is asking. */
const CLIENT_PATH = "/agent/client";

/**
 * The registrations all of Nakafa takes: twenty an hour. An agent registers once per install,
 * and the route takes no credential, so without this anyone could grow the table without end.
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

/** The scope of every grant: the sign-in, and the refresh token that outlives a Convex token. */
const AGENT_SCOPE = "openid offline_access";

/** The seconds a Convex token holds, which is what `/convex/token` signs. */
const CONVEX_TOKEN_SECONDS = 900;

/** An issued token answer: the token this module swaps, and the rest as it came. */
const IssuedToken = Schema.StructWithRest(
  Schema.Struct({ access_token: Schema.String }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

/** A token request that spends a refresh token. */
const RefreshRequest = Schema.Struct({ refresh_token: Schema.String });

/** The grant behind an issued token. */
const StoredGrant = Schema.Struct({
  clientId: Schema.String,
  userId: Schema.String,
});

/** The query of the consent page's read. */
const ClientQuery = Schema.Struct({ client_id: Schema.String });

/** The registered client the consent page names. */
const StoredClient = Schema.Struct({
  name: Schema.NullishOr(Schema.String),
  redirectUrls: Schema.String,
});

/** The part of the hook context that this module reads, as `DispatchContext` types it. */
type TokenHook = Pick<DispatchContext, "body" | "context"> & {
  readonly json: (body: Readonly<Record<string, unknown>>) => unknown;
};

/** The session label of one agent, so a refresh finds the session it had. */
const labelOf = (clientId: string) => `agent:${clientId}`;

/**
 * The live session of one agent of a person, or a new one. A Convex token names a session, and
 * a write checks that session is live, so an agent is one more signed-in device of its person:
 * ending the session ends the agent.
 */
const sessionOf = Effect.fn("auth.grant.session")(function* (
  hook: TokenHook,
  grant: typeof StoredGrant.Type
) {
  const { internalAdapter } = hook.context;
  const label = labelOf(grant.clientId);
  const now = yield* Clock.currentTimeMillis;
  const sessions = yield* Effect.tryPromise(() =>
    internalAdapter.listSessions(grant.userId)
  );
  const held = Arr.findFirst(
    sessions,
    (session) =>
      session.userAgent === label && session.expiresAt.getTime() > now
  );
  if (Option.isSome(held)) {
    return held.value;
  }
  return yield* Effect.tryPromise(() =>
    internalAdapter.createSession(grant.userId, false, { userAgent: label })
  );
});

/**
 * Deletes the row of a refresh token that a request just spent. The server writes a new row for
 * each refresh and keeps the old one, which a token that lasts 15 minutes would grow without
 * end, and a spent token that still works is one a thief can use.
 */
const spendRefreshToken = Effect.fn("auth.grant.spend")(function* (
  hook: TokenHook
) {
  const spent = Schema.decodeUnknownOption(RefreshRequest)(hook.body);
  if (Option.isNone(spent)) {
    return;
  }
  yield* Effect.tryPromise(() =>
    hook.context.adapter.delete({
      model: "oauthAccessToken",
      where: [{ field: "refreshToken", value: spent.value.refresh_token }],
    })
  );
});

/**
 * Answers a token request with a Convex token of the person, in place of the opaque token the
 * OAuth server stored. The server keeps the grant and its refresh token, and the person's own
 * functions verify the Convex token as they verify the web app's, so an agent can do what its
 * person can and nothing else. Anything but an issued token passes as it is.
 */
const issueConvexToken = Effect.fn("auth.grant.issue")(function* (
  ctx: GenericActionCtx<DataModel>,
  hook: TokenHook
) {
  const issued = Schema.decodeUnknownOption(IssuedToken)(hook.context.returned);
  if (Option.isNone(issued)) {
    return;
  }
  const stored = yield* Effect.tryPromise(() =>
    hook.context.adapter.findOne({
      model: "oauthAccessToken",
      where: [{ field: "accessToken", value: issued.value.access_token }],
    })
  );
  const grant = yield* Schema.decodeUnknownEffect(StoredGrant)(stored);
  const session = yield* sessionOf(hook, grant);
  const auth = yield* createAuth(ctx);
  const { token } = yield* Effect.tryPromise(() =>
    auth.api.getToken({
      headers: new Headers({ authorization: `Bearer ${session.token}` }),
    })
  );
  yield* spendRefreshToken(hook);
  return hook.json({
    ...issued.value,
    access_token: token,
    expires_in: CONVEX_TOKEN_SECONDS,
  });
}, Effect.provide(ConvexConfigProvider.layer));

/** Takes one registration from the limit, or refuses the request. */
const admitRegistration = Effect.fn("auth.grant.register")(function* (
  ctx: GenericActionCtx<DataModel>
) {
  const { ok } = yield* Effect.tryPromise(() =>
    registrations.limit(ctx, "agentRegistration")
  ).pipe(Effect.orDie);
  if (!ok) {
    return yield* Effect.fail(
      APIError.from("TOO_MANY_REQUESTS", {
        code: "AGENT_REGISTRATION_LIMITED",
        message: "Too many agents registered. Try again later.",
      })
    );
  }
});

/** The name and the address an agent registered, for the person who answers it. */
const readClient = Effect.fn("auth.grant.client")(function* (
  context: DispatchContext["context"],
  clientId: string
) {
  const stored = yield* Effect.tryPromise(() =>
    context.adapter.findOne({
      model: "oauthApplication",
      where: [{ field: "clientId", value: clientId }],
    })
  );
  const client = Schema.decodeUnknownOption(StoredClient)(stored);
  if (Option.isNone(client)) {
    return null;
  }
  return {
    name: client.value.name ?? null,
    redirect: Option.getOrNull(
      Option.liftThrowable((text: string) => new URL(text).host)(
        Arr.headNonEmpty(Str.split(",")(client.value.redirectUrls))
      )
    ),
  };
});

/**
 * What the router adds to the OAuth server for an agent. A client that registers itself is
 * untrusted, so every authorization asks the person, which the server skips unless the request
 * says `prompt=consent`. The router adds this plugin (`confect/http`), because only an action
 * can sign a token.
 */
export function agentGrants(
  ctx: GenericActionCtx<DataModel>
): NonNullable<BetterAuthOptions["plugins"]>[number] {
  return {
    id: "agent-grants",
    endpoints: {
      agentClient: createAuthEndpoint(
        CLIENT_PATH,
        { method: "GET", query: Schema.toStandardSchemaV1(ClientQuery) },
        (endpoint) =>
          Effect.runPromise(
            readClient(endpoint.context, endpoint.query.client_id)
          )
      ),
    },
    hooks: {
      after: [
        {
          handler: createAuthMiddleware((hook) =>
            Effect.runPromise(issueConvexToken(ctx, hook))
          ),
          matcher: (context) => context.path === TOKEN_PATH,
        },
      ],
      before: [
        {
          handler: createAuthMiddleware(() =>
            Effect.runPromise(admitRegistration(ctx))
          ),
          matcher: (context) => context.path === REGISTER_PATH,
        },
        {
          handler: createAuthMiddleware((hook) =>
            Promise.resolve({
              context: {
                query: { ...hook.query, prompt: "consent", scope: AGENT_SCOPE },
              },
            })
          ),
          matcher: (context) => context.path === AUTHORIZE_PATH,
        },
      ],
    },
  } satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
}
