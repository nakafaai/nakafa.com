import { Id } from "@repo/backend/confect/_generated/id";
import { GoogleConnector } from "@repo/backend/confect/connectors/google/manifest";
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

/**
 * One connect that waits for Google's callback: who started it, for which owner
 * and connector, the callback it named, and its PKCE verifier. The callback brings
 * the state back, and finishing the connect deletes the row, so a state works
 * once. A row older than `CONNECT_STATE_LIFETIME` finishes nothing. `personId` is
 * the school member who started a school connection, whom the journal names.
 */
export const connectStateValidator = Schema.Struct({
  connector: GoogleConnector,
  createdAt: Schema.Finite,
  owner: Space,
  personId: Schema.NullOr(Id("tenantPeople")),
  redirectUri: Schema.String,
  returnPath: Schema.String,
  state: Schema.String,
  userId: Id("users"),
  verifier: Schema.String,
});

/**
 * A path on the site that a connect returns to, such as `/settings/connections`:
 * it starts with one slash and names no other host, so the return address stays
 * on the site of the callback.
 */
export const ReturnPath = Schema.String.check(
  Schema.isPattern(/^\/(?![/\\])[^\s]*$/u),
  Schema.isMaxLength(200)
);

/** The ID of a file that Google Drive's Picker gives: letters, digits, `_`, and `-`. */
export const DriveFileId = Schema.String.check(
  Schema.isPattern(/^[\w-]{1,200}$/u)
);

/**
 * How a connect ended and where its user goes back to: `connected`, `cancelled`
 * when the user stopped on Google's screen, or `refused` when Google or the
 * granted scopes did not allow it. The address is built on the server from the
 * callback's own site, the school's slug, and the path the start named.
 */
export const ConnectOutcome = Schema.Struct({
  location: Schema.String,
  outcome: Schema.Literals(["connected", "cancelled", "refused"]),
});

/**
 * One upcoming event of a Calendar connection, in the mirror that Nina reads
 * (ADR 0015): when it starts and ends in UTC, whether it is a whole day, and its
 * title sealed under the account's own key, bound to the connection and the
 * event. A sync replaces a connection's events, and a disconnect deletes them.
 */
export const connectorEventValidator = Schema.Struct({
  allDay: Schema.Boolean,
  connectionId: Id("connectorConnections"),
  end: Schema.Finite,
  eventId: Schema.NonEmptyString,
  sealedTitle: Sealed,
  start: Schema.Finite,
  userId: Id("users"),
});

/** One upcoming event as a sync reads it from Google: its title, and when it starts and ends in UTC. */
export const CalendarEvent = Schema.Struct({
  allDay: Schema.Boolean,
  end: Schema.Finite,
  eventId: Schema.NonEmptyString,
  start: Schema.Finite,
  title: Schema.String,
});

/** One course that a connected teacher teaches in Google Classroom, as an import preview lists it. */
export const ClassroomCourse = Schema.Struct({
  courseId: Schema.NonEmptyString,
  name: Schema.String,
  section: Schema.NullOr(Schema.String),
});

/** One piece of published Classroom coursework with a deadline, which an import makes a task. */
export const ClassroomWork = Schema.Struct({
  deadline: Schema.Finite,
  points: Schema.Finite,
  text: Schema.String,
  title: Schema.String,
  workId: Schema.NonEmptyString,
});

/**
 * One course of a Classroom import preview: the course, how many students it
 * has, and the Nakafa class it is linked to, if one is.
 */
export const ClassroomPreview = Schema.Struct({
  ...ClassroomCourse.fields,
  classId: Schema.NullOr(Id("classes")),
  students: Schema.Int,
});

/**
 * The link of one Google Classroom course to one Nakafa class (ADR 0015): the
 * school connection that reads it, and the member who linked it, whom the tasks
 * it imports name as their author. A sync imports the course's coursework into
 * the class's tasks.
 */
export const connectorLinkValidator = Schema.Struct({
  classId: Id("classes"),
  connectionId: Id("connectorConnections"),
  courseId: Schema.NonEmptyString,
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});
