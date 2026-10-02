import { Id } from "@repo/backend/confect/_generated/id";
import { Change, ObjectRef } from "@repo/backend/confect/access/catalog";
import { Space } from "@repo/backend/confect/space";
import { Schema, SchemaTransformation } from "effect";

/** Who performed a change, in either data space. */
export const Actor = Schema.Union([
  /** An account acting in its personal space. */
  Schema.Struct({ id: Id("users"), kind: Schema.Literal("user") }),
  /** A member acting inside a tenant. */
  Schema.Struct({ id: Id("tenantPeople"), kind: Schema.Literal("person") }),
  /** Scheduled or cascading work. */
  Schema.Struct({ kind: Schema.Literal("system") }),
]);
export type Actor = typeof Actor.Type;

/**
 * One audited change, immutable once written. Its owner and subject come
 * from the subject's row, never from the caller.
 */
export const JournalEntry = Schema.Struct({
  actor: Actor,
  change: Change,
  owner: Space,
  subject: ObjectRef,
});

/**
 * A change type another lane added after this client was built decodes as
 * `{ type: "unknown" }`, so an open tab renders a generic row instead of
 * failing to decode the whole page.
 */
const UnknownChange = Schema.Struct({ type: Schema.String }).pipe(
  Schema.decodeTo(
    Schema.Struct({ type: Schema.Literal("unknown") }),
    SchemaTransformation.transform({
      decode: (_change: { readonly type: string }) => ({
        type: "unknown" as const,
      }),
      encode: (change: {
        readonly type: "unknown";
      }): {
        readonly type: string;
      } => change,
    })
  )
);
/** A kind added after this client was built decodes as `{ kind: "unknown" }`. */
const UnknownSubject = Schema.Struct({ kind: Schema.String }).pipe(
  Schema.decodeTo(
    Schema.Struct({ kind: Schema.Literal("unknown") }),
    SchemaTransformation.transform({
      decode: (_subject: { readonly kind: string }) => ({
        kind: "unknown" as const,
      }),
      encode: (subject: {
        readonly kind: "unknown";
      }): {
        readonly kind: string;
      } => subject,
    })
  )
);

/** A change on the wire, tolerant of change types added later. */
export const ChangeView = Schema.Union([...Change.members, UnknownChange]);

/** A subject on the wire, tolerant of kinds added later. */
export const SubjectView = Schema.Union([...ObjectRef.members, UnknownSubject]);
