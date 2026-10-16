import { Id } from "@repo/backend/confect/_generated/id";
import { Change, ObjectRef } from "@repo/backend/confect/access/catalog";
import { Space } from "@repo/backend/confect/space";
import { Schema, SchemaGetter } from "effect";

/**
 * Who performed a change inside a tenant. Tenant rows name Persons, never
 * accounts, so they hold no account ID that would outlive a deleted account.
 */
export const TenantActor = Schema.Union([
  /** A member acting inside a tenant. */
  Schema.Struct({ id: Id("tenantPeople"), kind: Schema.Literal("person") }),
  /** Nakafa staff acting outside a visit, such as to open or suspend a school. */
  Schema.Struct({ id: Id("operators"), kind: Schema.Literal("operator") }),
  /** Scheduled or cascading work. */
  Schema.Struct({ kind: Schema.Literal("system") }),
]).pipe(Schema.toTaggedUnion("kind"));

/** Who performed a change, in either data space. */
export const Actor = Schema.Union([
  /** An account acting in its personal space. */
  Schema.Struct({ id: Id("users"), kind: Schema.Literal("user") }),
  ...TenantActor.members,
]).pipe(Schema.toTaggedUnion("kind"));

/**
 * One audited change, immutable once written. Its owner and subject come
 * from the subject's row through its kind's authority, never from the caller.
 */
export const JournalEntry = Schema.Struct({
  actor: Actor,
  change: Change,
  owner: Space,
  subject: ObjectRef,
});

const unknown = Schema.Literal("unknown");

/**
 * A change type another lane added after this client was built decodes as
 * `{ type: "unknown" }`, so an open tab renders a generic row instead of
 * failing to decode the whole page.
 */
const UnknownChange = Schema.Struct({ type: Schema.String }).pipe(
  Schema.decodeTo(Schema.Struct({ type: unknown }), {
    decode: SchemaGetter.succeed({ type: unknown.literal }),
    encode: SchemaGetter.passthroughSubtype(),
  })
);

/** A kind added after this client was built decodes as `{ kind: "unknown" }`. */
const UnknownSubject = Schema.Struct({ kind: Schema.String }).pipe(
  Schema.decodeTo(Schema.Struct({ kind: unknown }), {
    decode: SchemaGetter.succeed({ kind: unknown.literal }),
    encode: SchemaGetter.passthroughSubtype(),
  })
);

/** A change on the wire, tolerant of change types added later. */
export const ChangeView = Schema.Union([...Change.members, UnknownChange]);

/** A subject on the wire, tolerant of kinds added later. */
export const SubjectView = Schema.Union([...ObjectRef.members, UnknownSubject]);

/** The consumers that read the journal with a cursor of their own. */
export const JournalConsumer = Schema.Literals(["inbox"]);

/** The change types a consumer reads. */
export const ConsumedChangeType = Schema.Literals(["person.invited"]);

/**
 * One consumer's place in the journal for one tenant and one change type.
 * `since` is the creation time of the cursor: the consumer reads only the entries
 * created at or after it, so the entries recorded before the consumer existed
 * are never replayed. `position` is the pagination cursor that the consumer's
 * last read ended on, so its next read starts exactly after the entries already
 * read, including entries that share a creation millisecond. `pending` says a
 * run is owed: a change sets it, and a run that reads to the end clears it, so
 * the sweep can find the cursors whose run never happened.
 */
export const JournalCursor = Schema.Struct({
  changeType: ConsumedChangeType,
  consumer: JournalConsumer,
  pending: Schema.Boolean,
  position: Schema.NullOr(Schema.String),
  since: Schema.Finite,
  tenantId: Id("tenants"),
});
