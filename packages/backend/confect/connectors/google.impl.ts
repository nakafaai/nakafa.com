import type { GenericId, Ref } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { blindGoogleAccount } from "@repo/backend/confect/connectors/account";
import {
  connect,
  disconnect,
} from "@repo/backend/confect/connectors/connection";
import {
  ConnectorOff,
  ConnectStateInvalid,
  ScopesMissing,
} from "@repo/backend/confect/connectors/errors";
import {
  readGoogleClient,
  readOfferedConnectors,
} from "@repo/backend/confect/connectors/google/client";
import {
  CALLBACK_PATH,
  GOOGLE_MANIFEST,
  type GoogleConnector,
  requestedScopes,
} from "@repo/backend/confect/connectors/google/manifest";
import {
  authorizationUrl,
  exchangeCode,
  newState,
  pkcePair,
} from "@repo/backend/confect/connectors/google/oauth";
import spec from "@repo/backend/confect/connectors/google.spec";
import type { ConnectOutcome } from "@repo/backend/confect/connectors/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { readSiteUrls } from "@repo/backend/confect/site/config";
import { Space } from "@repo/backend/confect/space";
import { schoolAddress } from "@repo/backend/confect/tenancy/address";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Option,
  Schema,
} from "effect";

/** Whether two owners are the same account or the same school. */
const sameOwner = Schema.toEquivalence(Space);

/** How long a started connect waits for its callback. */
const CONNECT_STATE_LIFETIME = Duration.minutes(10);

/** The most earlier connects of one account that a new start clears. */
const STATE_SWEEP = 10;

/**
 * Whether a callback address is the callback of a site this deployment serves.
 * Google registers each one exactly, so a start names the one of the site the
 * user is on and never any other address (ADR 0015).
 */
const checkCallback = Effect.fn("connectors.google.checkCallback")(function* (
  redirectUri: string
) {
  const sites = yield* readSiteUrls().pipe(Effect.orDie);
  const callbacks = Arr.map(sites, (site) => new URL(CALLBACK_PATH, site).href);
  if (!Arr.contains(callbacks, redirectUri)) {
    return yield* new ConnectorOff();
  }
});

/**
 * Starts one connect: checks the connector and the callback, clears the account's
 * earlier connects, stores the new one with its PKCE verifier, and answers the
 * address of Google's consent screen.
 */
const begin = Effect.fn("connectors.google.begin")(function* (start: {
  readonly connector: GoogleConnector;
  readonly owner: Space;
  readonly personId: GenericId.GenericId<"tenantPeople"> | null;
  readonly redirectUri: string;
  readonly returnPath: string;
  readonly userId: GenericId.GenericId<"users">;
}) {
  const client = yield* readGoogleClient(start.connector);
  yield* checkCallback(start.redirectUri);
  const writer = yield* DatabaseWriter;
  const earlier = yield* (yield* DatabaseReader)
    .table("connectorStates")
    .index("by_userId", (query) => query.eq("userId", start.userId))
    .take(STATE_SWEEP)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    earlier,
    (row) => writer.table("connectorStates").delete(row._id),
    { discard: true }
  ).pipe(Effect.orDie);
  const { challenge, verifier } = yield* pkcePair().pipe(Effect.orDie);
  const state = yield* newState().pipe(Effect.orDie);
  yield* writer
    .table("connectorStates")
    .insert({
      ...start,
      createdAt: yield* Clock.currentTimeMillis,
      state,
      verifier,
    })
    .pipe(Effect.orDie);
  return {
    url: authorizationUrl({
      challenge,
      clientId: client.id,
      redirectUri: start.redirectUri,
      scopes: requestedScopes(start.connector),
      state,
    }),
  };
});

/** The Google connectors this deployment offers. */
const offered = FunctionImpl.make(
  databaseSchema,
  spec,
  "offered",
  Effect.fn("connectors.google.offered")(function* () {
    return yield* readOfferedConnectors();
  })
);

/** Starts a personal connection of the signed-in account to Drive or Calendar. */
const startPersonal = FunctionImpl.make(
  databaseSchema,
  spec,
  "startPersonal",
  Effect.fn("connectors.google.startPersonal")(function* ({
    connector,
    redirectUri,
    returnPath,
  }) {
    const { appUser } = yield* requireAuth();
    if (GOOGLE_MANIFEST[connector].owner !== "personal") {
      return yield* new ConnectorOff();
    }
    return yield* begin({
      connector,
      owner: { kind: "personal", userId: appUser._id },
      personId: null,
      redirectUri,
      returnPath,
      userId: appUser._id,
    });
  })
);

/** Starts a school connection to Classroom, for a teacher or an Admin of the school. */
const startSchool = FunctionImpl.make(
  databaseSchema,
  spec,
  "startSchool",
  Effect.fn("connectors.google.startSchool")(function* ({
    connector,
    redirectUri,
    returnPath,
  }) {
    const { person, tenant } = yield* Member;
    const { appUser } = yield* requireAuth().pipe(Effect.orDie);
    if (GOOGLE_MANIFEST[connector].owner !== "school") {
      return yield* new ConnectorOff();
    }
    return yield* begin({
      connector,
      owner: { kind: "tenant", tenantId: tenant._id },
      personId: person._id,
      redirectUri,
      returnPath,
      userId: appUser._id,
    });
  })
);

/**
 * Takes the connect that a state names, once: the row is deleted whatever it
 * holds. A state that is unknown, older than its lifetime, or started by another
 * account answers none. The return address is the start's path on the callback's
 * own site, or on the school's host of that site for a school connect, so it
 * never leaves the site.
 */
const claim = FunctionImpl.make(
  databaseSchema,
  spec,
  "claim",
  Effect.fn("connectors.google.claim")(function* ({ state, userId }) {
    const reader = yield* DatabaseReader;
    const found = yield* reader
      .table("connectorStates")
      .index("by_state", (query) => query.eq("state", state))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(found)) {
      return null;
    }
    const row = found.value;
    yield* (yield* DatabaseWriter)
      .table("connectorStates")
      .delete(row._id)
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    if (
      row.userId !== userId ||
      now - row.createdAt > Duration.toMillis(CONNECT_STATE_LIFETIME)
    ) {
      return null;
    }
    const site = new URL(row.redirectUri);
    const base = yield* Space.match(row.owner, {
      personal: () => Effect.succeed(site.href),
      tenant: ({ tenantId }) =>
        reader
          .table("tenants")
          .get(tenantId)
          .pipe(
            Effect.flatMap((tenant) => schoolAddress(site, tenant.slug)),
            Effect.orDie
          ),
    });
    return {
      connector: row.connector,
      location: new URL(row.returnPath, base).href,
      owner: row.owner,
      personId: row.personId,
      redirectUri: row.redirectUri,
      verifier: row.verifier,
    };
  })
);

/**
 * Connects the claimed start with the code of Google's callback: exchanges the
 * code, checks that every scope of the connector was granted, and stores the
 * connection.
 */
const connectClaimed = Effect.fn("connectors.google.connectClaimed")(function* (
  claimed: NonNullable<
    Ref.Returns<typeof refs.internal.connectors.google.claim>
  >,
  code: string,
  userId: GenericId.GenericId<"users">
) {
  const client = yield* readGoogleClient(claimed.connector);
  const grant = yield* exchangeCode(client, {
    code,
    redirectUri: claimed.redirectUri,
    verifier: claimed.verifier,
  }).pipe(Effect.provide(FetchClient));
  const needed = requestedScopes(claimed.connector);
  if (!Arr.every(needed, (scope) => Arr.contains(grant.scopes, scope))) {
    return yield* new ScopesMissing();
  }
  const { runMutation } = yield* MutationRunner;
  yield* runMutation(refs.internal.connectors.google.store, {
    connector: claimed.connector,
    owner: claimed.owner,
    personId: claimed.personId,
    refreshToken: grant.refreshToken,
    scopes: needed,
    subject: grant.subject,
    userId,
  }).pipe(Effect.orDie);
});

/**
 * Finishes a connect from Google's callback. The state is taken first, so it
 * works once, and a state that is not the caller's or is too old fails. A callback
 * without a code, as when the user stops on Google's screen, connects nothing.
 * A refusal of Google, a scope left unchecked, or a connector turned off since the
 * start connects nothing either, and the answer says so with the address to
 * return to, so the user always lands back on the page they started from.
 */
const finish = FunctionImpl.make(
  databaseSchema,
  spec,
  "finish",
  Effect.fn("connectors.google.finish")(function* ({ code, state }) {
    const { appUser } = yield* requireAuth();
    const { runMutation } = yield* MutationRunner;
    const claimed = yield* runMutation(refs.internal.connectors.google.claim, {
      state,
      userId: appUser._id,
    }).pipe(Effect.orDie);
    if (claimed === null) {
      return yield* new ConnectStateInvalid();
    }
    const ended = (
      outcome: (typeof ConnectOutcome.Type)["outcome"]
    ): typeof ConnectOutcome.Type => ({ location: claimed.location, outcome });
    if (code === null) {
      return ended("cancelled");
    }
    const refused = () => Effect.succeed(ended("refused"));
    return yield* connectClaimed(claimed, code, appUser._id).pipe(
      Effect.as(ended("connected")),
      Effect.catchTags({
        ConnectorOff: refused,
        GoogleFailed: refused,
        ScopesMissing: refused,
      })
    );
  })
);

/**
 * Stores a finished connection. A connection of the same owner, connector, and
 * Google account that is still active or waits to reconnect ends first, so
 * connecting again replaces it and never leaves two. The journal names the
 * school member for a school connection and the account for a personal one.
 */
const store = FunctionImpl.make(
  databaseSchema,
  spec,
  "store",
  Effect.fn("connectors.google.store")(function* (args) {
    const actor =
      args.personId === null
        ? { id: args.userId, kind: "user" as const }
        : { id: args.personId, kind: "person" as const };
    const key = yield* blindGoogleAccount(args.subject).pipe(Effect.orDie);
    const reader = yield* DatabaseReader;
    const earlier = yield* Effect.forEach(
      ["active", "reconnect"] as const,
      (status) =>
        reader
          .table("connectorConnections")
          .index("by_googleAccountKey_and_status", (query) =>
            query.eq("googleAccountKey", key).eq("status", status)
          )
          .take(STATE_SWEEP)
    ).pipe(Effect.orDie);
    yield* Effect.forEach(
      Arr.filter(
        Arr.flatten(earlier),
        (row) =>
          row.connector === args.connector && sameOwner(row.owner, args.owner)
      ),
      (row) => disconnect(actor, row),
      { discard: true }
    );
    return yield* connect(actor, args.owner, {
      connector: args.connector,
      googleSubject: args.subject,
      refreshToken: args.refreshToken,
      scopes: args.scopes,
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(offered),
  Layer.provide(startPersonal),
  Layer.provide(startSchool),
  Layer.provide(finish),
  Layer.provide(claim),
  Layer.provide(store),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
