import type { GenericId } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Authority } from "@repo/backend/confect/access/policy";
import { blindGoogleAccount } from "@repo/backend/confect/connectors/account";
import { connection } from "@repo/backend/confect/connectors/kinds";
import type { ConnectionInput } from "@repo/backend/confect/connectors/schema";
import { sealRefreshToken } from "@repo/backend/confect/connectors/secret";
import { type Actor, JournalEntry } from "@repo/backend/confect/journal/schema";
import { Space } from "@repo/backend/confect/space";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Effect, Option, Schema } from "effect";

type ConnectionDoc = Docs["connectorConnections"];

/** One connection as its owner's list shows it. Its token and its Google account key stay on the server. */
export const view = (row: ConnectionDoc) => ({
  connector: row.connector,
  createdAt: row._creationTime,
  id: row._id,
  lastSyncedAt: row.lastSyncedAt,
  nextSyncAt: row.nextSyncAt,
  scopes: row.scopes,
  status: row.status,
});

/** Whether a connection is a personal connection of the account. */
const isOwnedBy = (row: ConnectionDoc, userId: GenericId.GenericId<"users">) =>
  Space.match(row.owner, {
    personal: (owner) => owner.userId === userId,
    tenant: () => false,
  });

/**
 * Loads a personal connection that the account owns. A missing connection, a
 * school's and another account's all get the same denial, so an ID probe reveals
 * nothing.
 */
export const loadOwnConnection = Effect.fn("connectors.connection.loadOwn")(
  function* (
    userId: GenericId.GenericId<"users">,
    connectionId: GenericId.GenericId<"connectorConnections">
  ) {
    const found = yield* Authority.load(connection)(connectionId);
    if (Option.isNone(found) || !isOwnedBy(found.value, userId)) {
      return yield* new AccessDenied({
        action: "connection.manage",
        reason: "resource",
      });
    }
    return found.value;
  }
);

/** Journals one change of a connection under the space that owns it. */
const record = Effect.fn("connectors.connection.record")(function* (
  actor: typeof Actor.Type,
  owner: Space,
  connectionId: GenericId.GenericId<"connectorConnections">,
  change: (typeof JournalEntry.Type)["change"]
) {
  const entry = yield* Schema.decodeUnknownEffect(JournalEntry)({
    actor,
    change,
    owner,
    subject: { id: connectionId, kind: "connection" },
  }).pipe(Effect.orDie);
  yield* (yield* DatabaseWriter)
    .table("journalEntries")
    .insert(entry)
    .pipe(Effect.orDie);
});

/**
 * Stores a connection with its refresh token sealed under the owner's key, and
 * journals the connection. The Google account's subject is blinded under the
 * connector key before the row is written, so the row never holds the subject. The
 * token is written in the same transaction as the connection, so no connection
 * exists without its secret.
 */
export const connect = Effect.fn("connectors.connection.connect")(function* (
  actor: typeof Actor.Type,
  owner: Space,
  input: typeof ConnectionInput.Type
) {
  const writer = yield* DatabaseWriter;
  const googleAccountKey =
    input.googleSubject === null
      ? null
      : yield* blindGoogleAccount(input.googleSubject);
  const connectionId = yield* writer
    .table("connectorConnections")
    .insert({
      connector: input.connector,
      googleAccountKey,
      lastSyncedAt: null,
      nextSyncAt: null,
      owner,
      scopes: input.scopes,
      status: "active",
    })
    .pipe(Effect.orDie);
  const refreshToken = yield* sealRefreshToken(
    owner,
    connectionId,
    input.refreshToken
  ).pipe(Effect.orDie);
  yield* writer
    .table("connectorSecrets")
    .insert({ connectionId, refreshToken })
    .pipe(Effect.orDie);
  yield* record(actor, owner, connectionId, {
    connection: connectionId,
    connector: input.connector,
    type: "connection.connected",
  });
  return connectionId;
});

/**
 * Deletes the sealed token of a connection. A connection whose token is already gone
 * has nothing to destroy. The account deletion drain uses it too (ADR 0015).
 */
export const destroySecret = Effect.fn("connectors.connection.destroySecret")(
  function* (connectionId: GenericId.GenericId<"connectorConnections">) {
    const secret = yield* (yield* DatabaseReader)
      .table("connectorSecrets")
      .index("by_connectionId", (query) =>
        query.eq("connectionId", connectionId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(secret)) {
      yield* (yield* DatabaseWriter)
        .table("connectorSecrets")
        .delete(secret.value._id)
        .pipe(Effect.orDie);
    }
  }
);

/** The most mirrored events of one connection that a disconnect deletes, the most a sync keeps and some room. */
const MIRROR_PURGE = 200;

/**
 * Deletes the Calendar mirror of a connection, which a disconnect always does
 * (ADR 0015). A connection of another connector has none.
 */
const purgeMirror = Effect.fn("connectors.connection.purgeMirror")(function* (
  connectionId: GenericId.GenericId<"connectorConnections">
) {
  const events = yield* (yield* DatabaseReader)
    .table("connectorEvents")
    .index("by_connectionId_and_start", (query) =>
      query.eq("connectionId", connectionId)
    )
    .take(MIRROR_PURGE)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    events,
    (event) => writer.table("connectorEvents").delete(event._id),
    { discard: true }
  ).pipe(Effect.orDie);
});

/**
 * Moves a connection to `reconnect` when its source stops accepting its token:
 * its sync stops until its owner connects again, which ends it and makes a new
 * one. A connection already waiting or ended stays as it is.
 */
export const markReconnect = Effect.fn("connectors.connection.reconnect")(
  function* (row: ConnectionDoc) {
    if (row.status !== "active") {
      return;
    }
    yield* (yield* DatabaseWriter)
      .table("connectorConnections")
      .patch(row._id, { nextSyncAt: null, status: "reconnect" })
      .pipe(Effect.orDie);
    yield* record(systemActor, row.owner, row._id, {
      connection: row._id,
      connector: row.connector,
      type: "connection.reconnect",
    });
  }
);

/**
 * Ends a connection: destroys its sealed token and its Calendar mirror, marks it
 * disconnected, and journals one change. A connection that is already disconnected stays so with no second
 * entry, so a retried request succeeds.
 */
export const disconnect = Effect.fn("connectors.connection.disconnect")(
  function* (actor: typeof Actor.Type, row: ConnectionDoc) {
    if (row.status === "disconnected") {
      return;
    }
    yield* destroySecret(row._id);
    yield* purgeMirror(row._id);
    yield* (yield* DatabaseWriter)
      .table("connectorConnections")
      .patch(row._id, { nextSyncAt: null, status: "disconnected" })
      .pipe(Effect.orDie);
    yield* record(actor, row.owner, row._id, {
      connection: row._id,
      connector: row.connector,
      type: "connection.disconnected",
    });
  }
);
