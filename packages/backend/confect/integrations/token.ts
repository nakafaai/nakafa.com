import type { GenericId } from "@confect/core";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { IntegrationClientsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  DocumentIds,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  SCHOOL_HOST_API_PATH,
  SCHOOL_HOST_MCP_PATH,
  TOKEN_SECONDS,
} from "@repo/backend/confect/integrations/api";
import type {
  TokenCheck,
  TokenIssue,
  TokenResource,
} from "@repo/backend/confect/integrations/schema";
import { sha256Hex } from "@repo/utilities/digest";
import { issueToken, matchesToken } from "@repo/utilities/token";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Option,
  String as Str,
} from "effect";

/**
 * The requests of one client: 600 a minute, the target of ADR 0029, and the tokens it may
 * ask for: twenty a minute. Both are design choices, not measurements.
 */
const LIMITS = {
  schoolApiRequest: {
    capacity: 600,
    kind: "token bucket",
    period: MINUTE,
    rate: 600,
  },
  schoolApiToken: {
    capacity: 20,
    kind: "token bucket",
    period: MINUTE,
    rate: 20,
  },
} as const;

const limits = new RateLimiter(components.agentRateLimiter, LIMITS);

/** The slash a resource indicator may end its path with. */
const TRAILING_SLASH = /\/$/;

/** The paths of a school host that a resource indicator may name, and the resource each names. */
const RESOURCE_PATHS: Readonly<Record<string, typeof TokenResource.Type>> = {
  [SCHOOL_HOST_API_PATH]: "api",
  [SCHOOL_HOST_MCP_PATH]: "mcp",
};

/**
 * The resource a token request names (RFC 8707): the school REST API when it names none,
 * or the API or the MCP server of the client's own school host. A resource of another
 * school or of another path names none, so the request is refused as `invalid_target`.
 */
const resourceOf = (
  resource: string | undefined,
  slug: string
): Option.Option<typeof TokenResource.Type> => {
  if (resource === undefined) {
    return Option.some("api");
  }
  return Option.liftThrowable((text: string) => new URL(text))(resource).pipe(
    Option.filter(
      (url) =>
        url.protocol === "https:" &&
        Arr.head(Str.split(".")(url.hostname)).pipe(Option.contains(slug))
    ),
    Option.flatMap((url) =>
      Option.fromUndefinedOr(
        RESOURCE_PATHS[Str.replace(TRAILING_SLASH, "")(url.pathname)]
      )
    )
  );
};

/** The access tokens of one client, at most this many, which ending a client deletes. */
const TOKEN_LIMIT = 200;

/** Deletes every access token of one client, when it is revoked or its secret rotates. */
export const endClientTokens = Effect.fn("integrations.token.end")(function* (
  clientId: GenericId.GenericId<"integrationClients">
) {
  const tokens = yield* (yield* DatabaseReader)
    .table("integrationTokens")
    .index("by_clientId", (query) => query.eq("clientId", clientId))
    .take(TOKEN_LIMIT)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    tokens,
    (token) =>
      writer.table("integrationTokens").delete(token._id).pipe(Effect.orDie),
    { discard: true }
  );
});

/**
 * Draws a new access token of one client for one resource, stores its digest with its
 * lifetime, and answers the token, which is shown once.
 */
export const storeToken = Effect.fn("integrations.token.store")(function* (
  client: Pick<IntegrationClientsDoc, "_id" | "tenantId">,
  resource: typeof TokenResource.Type,
  seconds: number
) {
  const { hash, token } = yield* issueToken();
  const now = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("integrationTokens")
    .insert({
      clientId: client._id,
      expiresAt: now + Duration.toMillis(Duration.seconds(seconds)),
      resource,
      tenantId: client.tenantId,
      tokenHash: hash,
    })
    .pipe(Effect.orDie);
  return token;
});

/**
 * Issues an access token with the client credentials grant (RFC 6749 section 4.4). The
 * client must be active and present its own secret, which is compared by digest in constant
 * time. The token is random, lives `TOKEN_SECONDS`, is bound to the resource it was asked
 * for, and only its digest is stored. Every refusal of the client reads the same.
 */
export const issueAccessToken = Effect.fn("integrations.token.issue")(
  function* (input: {
    readonly clientId: string;
    readonly resource?: string | undefined;
    readonly secret: string;
  }) {
    const invalidClient: typeof TokenIssue.Type = {
      error: "invalid_client",
      outcome: "refused",
    };
    const ctx = yield* MutationCtx;
    const parsed = yield* (yield* DocumentIds).parse(
      "integrationClients",
      input.clientId
    );
    if (Option.isNone(parsed)) {
      return invalidClient;
    }
    const clientId = parsed.value;
    const client = yield* (yield* DatabaseReader)
      .table("integrationClients")
      .get(clientId)
      .pipe(Effect.option);
    if (
      Option.isNone(client) ||
      client.value.secretHash === null ||
      client.value.status !== "active"
    ) {
      return invalidClient;
    }
    const quota = yield* Effect.tryPromise(() =>
      limits.limit(ctx, "schoolApiToken", { key: clientId })
    ).pipe(Effect.orDie);
    if (
      !(
        quota.ok && (yield* matchesToken(input.secret, client.value.secretHash))
      )
    ) {
      return invalidClient;
    }
    const tenant = yield* (yield* DatabaseReader)
      .table("tenants")
      .get(client.value.tenantId)
      .pipe(Effect.orDie);
    const resource = resourceOf(input.resource, tenant.slug);
    if (Option.isNone(resource)) {
      const refused: typeof TokenIssue.Type = {
        error: "invalid_target",
        outcome: "refused",
      };
      return refused;
    }
    const token = yield* storeToken(
      client.value,
      resource.value,
      TOKEN_SECONDS
    );
    const issued: typeof TokenIssue.Type = {
      expiresIn: TOKEN_SECONDS,
      outcome: "issued",
      token,
    };
    return issued;
  }
);

/**
 * Checks one bearer token for one resource, and counts the request against its client's
 * limit. A token that is unknown, expired, issued for the other resource, or of a client
 * that is no longer active is unauthorized; a client past its limit is told when to retry.
 */
export const checkAccessToken = Effect.fn("integrations.token.check")(
  function* (input: {
    readonly resource: typeof TokenResource.Type;
    readonly token: string;
  }) {
    const unauthorized: typeof TokenCheck.Type = { outcome: "unauthorized" };
    const reader = yield* DatabaseReader;
    const tokenHash = yield* sha256Hex(input.token);
    const stored = yield* reader
      .table("integrationTokens")
      .index("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
      .first()
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    if (
      Option.isNone(stored) ||
      stored.value.expiresAt <= now ||
      stored.value.resource !== input.resource
    ) {
      return unauthorized;
    }
    const client = yield* reader
      .table("integrationClients")
      .get(stored.value.clientId)
      .pipe(Effect.orDie);
    if (client.status !== "active") {
      return unauthorized;
    }
    const ctx = yield* MutationCtx;
    const quota = yield* Effect.tryPromise(() =>
      limits.limit(ctx, "schoolApiRequest", { key: client._id })
    ).pipe(Effect.orDie);
    if (!quota.ok) {
      const limited: typeof TokenCheck.Type = {
        outcome: "limited",
        retryAfter: Math.ceil(quota.retryAfter / 1000),
      };
      return limited;
    }
    const allowed: typeof TokenCheck.Type = {
      clientId: client._id,
      outcome: "allowed",
    };
    return allowed;
  }
);

/** Tokens one sweep deletes; a backlog takes more runs. */
const SWEEP_LIMIT = 200;

/** Deletes access tokens that expired. */
export const sweepTokens = Effect.fn("integrations.token.sweep")(function* () {
  const now = yield* Clock.currentTimeMillis;
  const expired = yield* (yield* DatabaseReader)
    .table("integrationTokens")
    .index("by_expiresAt", (query) => query.lte("expiresAt", now))
    .take(SWEEP_LIMIT)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    expired,
    (token) =>
      writer.table("integrationTokens").delete(token._id).pipe(Effect.orDie),
    { discard: true }
  );
  return null;
});
