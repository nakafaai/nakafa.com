import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import spec, {
  type ClassPerson,
} from "@repo/backend/confect/classroom/people.spec";
import {
  classRoster,
  classTeachers,
} from "@repo/backend/confect/classroom/roster";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Order } from "effect";

/** Teachers first, then by name in the order of the language-neutral comparison. */
const byKindThenName = Order.combine(
  Order.mapInput(Order.String, (found: typeof ClassPerson.Type) =>
    found.kind === "teacher" ? "0" : "1"
  ),
  Order.mapInput(Order.String, (found: typeof ClassPerson.Type) =>
    found.name.toLocaleLowerCase()
  )
);

/** The class's teachers and students, each once, as the roster of its forum holds them. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.people.list")(function* () {
    const row = yield* Class;
    const roster = yield* classRoster(row);
    const teaching = yield* classTeachers(row);
    return Arr.sort(
      Arr.map(roster, (person) => ({
        id: person._id,
        kind: Arr.some(teaching, (found) => found.personId === person._id)
          ? ("teacher" as const)
          : ("student" as const),
        name: person.name,
      })),
      byKindThenName
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
