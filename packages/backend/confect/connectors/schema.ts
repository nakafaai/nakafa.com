import { Id } from "@repo/backend/confect/_generated/id";
import { Space } from "@repo/backend/confect/space";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/**
 * The connectors a school or an account can connect (ADR 0015). Dapodik reads an
 * uploaded XLSX roster and calls no API, so it holds no Google account.
 */
export const ConnectorKind = Schema.Literals([
  "drive",
  "forms",
  "classroom",
  "calendar",
  "gmail",
  "dapodik",
]);

/**
 * Where a connection stands: `active` reads its source, `reconnect` waits for its
 * owner to connect again because the source refused its token, and `disconnected`
 * ended the connection and destroyed its token.
 */
const ConnectionStatus = Schema.Literals([
  "active",
  "reconnect",
  "disconnected",
]);

/** One scope that a connection holds, named as its connector names it. */
const ConnectorScope = Schema.NonEmptyString;

/**
 * The blind of the Google account behind a connection: the 22 URL-safe characters
 * that `blindConnectorText` makes under the connector key. Connections of every
 * owner with the same blind stand for one Google account, so the revoke rule counts
 * them (ADR 0015).
 */
const GoogleAccountKey = Schema.String.check(Schema.isPattern(/^[\w-]{22}$/u));

/**
 * One connection as the registry stores it. Its owner is the school, which
 * holds a school connection, or the account, which holds a personal one (ADR
 * 0015). Its creation time is its `_creationTime`. The sealed token lives in
 * `connectorSecrets`, not here.
 */
export const connectionValidator = Schema.Struct({
  connector: ConnectorKind,
  googleAccountKey: Schema.NullOr(GoogleAccountKey),
  lastSyncedAt: Schema.NullOr(Schema.Finite),
  nextSyncAt: Schema.NullOr(Schema.Finite),
  owner: Space,
  scopes: Schema.Array(ConnectorScope).check(Schema.isUnique()),
  status: ConnectionStatus,
});

/**
 * What a caller gives `connect` for one source. `googleSubject` is the subject of
 * the Google account, the value that identifies the account: `connect` blinds it
 * before it stores anything, so no row holds the subject. A source with no Google
 * account, such as Dapodik, gives `null`.
 */
export const ConnectionInput = Schema.Struct({
  connector: ConnectorKind,
  googleSubject: Schema.NullOr(Schema.NonEmptyString),
  refreshToken: Schema.NonEmptyString,
  scopes: Schema.Array(ConnectorScope).check(Schema.isUnique()),
});

/** The owner that a school connection names: its school's tenant, and never an account. */
export const SchoolOwnership = Schema.Struct({ owner: Space.cases.tenant });

/**
 * The sealed refresh token of one connection, one row for each connection. The
 * owner's key seals it, bound to the connection row, so it opens only for its own
 * connection (ADR 0030).
 */
export const connectorSecretValidator = Schema.Struct({
  connectionId: Id("connectorConnections"),
  refreshToken: Sealed,
});

/** One connection as its owner's list shows it. Its token and its Google account key never leave the server. */
export const ConnectionView = Schema.Struct({
  connector: ConnectorKind,
  createdAt: Schema.Finite,
  id: Id("connectorConnections"),
  lastSyncedAt: Schema.NullOr(Schema.Finite),
  nextSyncAt: Schema.NullOr(Schema.Finite),
  scopes: Schema.Array(ConnectorScope),
  status: ConnectionStatus,
});
