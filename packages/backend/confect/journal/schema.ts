import { Id } from "@repo/backend/confect/_generated/id";
import {
  entries,
  type kinds,
  ObjectRef,
} from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import { classKind } from "@repo/backend/confect/classroom/kinds";
import { connection } from "@repo/backend/confect/connectors/kinds";
import { sittingKind } from "@repo/backend/confect/exams/sittings/kinds";
import { integration } from "@repo/backend/confect/integrations/kinds";
import { visit } from "@repo/backend/confect/operators/kinds";
import { gradeKind } from "@repo/backend/confect/records/kinds";
import { Space } from "@repo/backend/confect/space";
import {
  cohort,
  period,
  person,
  promotion,
  tenant,
  unit,
} from "@repo/backend/confect/tenancy/kinds";
import { Array as Arr, Schema, SchemaGetter } from "effect";

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
  TenantActor,
]).pipe(Schema.toTaggedUnion("kind"));

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

/**
 * The stored entry of one kind: its actor, the given change union of that kind, its
 * owner, and the kind's own reference as its subject. The change union is passed in
 * from a call on the literal kind, because a change union taken from a generic kind
 * makes Confect 10.3.0 fail with TS2589.
 */
const entryOf = <
  const K extends (typeof kinds)[number],
  const C extends Schema.Top,
>(
  kind: K,
  change: C
) =>
  Schema.Struct({
    subject: kind.ref,
    actor: Actor,
    change,
    owner: Space,
  });

/**
 * One audited change, immutable once written. Its owner and subject come from the
 * subject's row through its kind's authority, never from the caller. The union has one
 * member for each kind that holds changes, so a subject can carry only its own kind's
 * changes. The members are listed here, not mapped from the catalog at run time: a
 * member whose changes come from a generic kind fails the table with TS2589 on Confect
 * 10.3.0, and so does a union above about 40 members. The catalog test checks that this
 * list holds exactly the kinds that hold changes.
 */
export const JournalEntry = Schema.Union([
  entryOf(classKind, Kind.changes(entries, classKind.kind)),
  entryOf(cohort, Kind.changes(entries, cohort.kind)),
  entryOf(connection, Kind.changes(entries, connection.kind)),
  entryOf(gradeKind, Kind.changes(entries, gradeKind.kind)),
  entryOf(integration, Kind.changes(entries, integration.kind)),
  entryOf(period, Kind.changes(entries, period.kind)),
  entryOf(person, Kind.changes(entries, person.kind)),
  entryOf(promotion, Kind.changes(entries, promotion.kind)),
  entryOf(sittingKind, Kind.changes(entries, sittingKind.kind)),
  entryOf(tenant, Kind.changes(entries, tenant.kind)),
  entryOf(unit, Kind.changes(entries, unit.kind)),
  entryOf(visit, Kind.changes(entries, visit.kind)),
]);

/**
 * A change on the wire: each kind's own changes, plus one member that decodes a
 * change type added later as `unknown`.
 */
export const ChangeView = Schema.Union([
  ...Arr.map(JournalEntry.members, (entry) => entry.fields.change),
  UnknownChange,
]);

/** A subject on the wire, tolerant of kinds added later. */
export const SubjectView = Schema.Union([...ObjectRef.members, UnknownSubject]);

/** The consumers that read the journal with a cursor of their own. */
export const JournalConsumer = Schema.Literals(["inbox"]);

/** The change types a consumer reads. */
export const ConsumedChangeType = Schema.Literals(["person.invited"]);

/**
 * One entry that a cursor has handled, with its creation time. The cursor drops the
 * entry once `since` moves past that creation time, so no later read returns it again.
 */
const HandledEntry = Schema.Struct({
  createdAt: Schema.Finite,
  entryId: Id("journalEntries"),
});

/**
 * One consumer's place in the journal for one tenant and one change type. Every entry
 * created before `since` is handled. `since` starts five seconds before the entry that
 * made the cursor, and it moves to the newest settled entry that a run handled, so it
 * never passes an entry that may still commit. `handled` holds the entries that a run
 * handled at or after `since` and that `since` has not passed: unsettled entries handled
 * early, and entries that share the creation time of `since`. A run skips them when it
 * reads again. `pending` says a run is owed: a change sets it, a run that leaves an entry
 * unread keeps it set, and a run that reads to the end clears it, so the sweep can find
 * the cursors whose run never happened.
 */
export const JournalCursor = Schema.Struct({
  changeType: ConsumedChangeType,
  consumer: JournalConsumer,
  handled: Schema.Array(HandledEntry),
  pending: Schema.Boolean,
  since: Schema.Finite,
  tenantId: Id("tenants"),
});
