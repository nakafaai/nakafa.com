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
