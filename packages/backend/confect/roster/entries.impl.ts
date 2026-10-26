import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/roster/entries.spec";
import {
  rosterEntryOf,
  rosterViewOf,
  writeRosterEntry,
} from "@repo/backend/confect/roster/entry";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer, Option } from "effect";

/**
 * Sets a student's NISN and under-age flag. A call without a NISN keeps the one on
 * file. The change is journaled as `roster.set` with no value (ADR 0016).
 */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("roster.entries.set")(function* ({ nisn, underAgeLimit }) {
    const { person: actor } = yield* Member;
    const person = yield* Person;
    yield* writeRosterEntry(person, {
      nisn: Option.fromUndefinedOr(nisn),
      underAgeLimit,
    });
    yield* personAuthority.record(personActor(actor), person, {
      type: "roster.set",
    });
    return rosterViewOf(person._id, yield* rosterEntryOf(person._id));
  })
);

/** Reads a student's roster row as staff see it: never the NISN itself. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("roster.entries.get")(function* () {
    const person = yield* Person;
    return rosterViewOf(person._id, yield* rosterEntryOf(person._id));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(set),
  Layer.provide(get),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(personAccess),
  GroupImpl.finalize
);
