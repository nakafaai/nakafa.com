import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import spec from "@repo/backend/confect/classroom/forum/people.spec";
import { classRoster } from "@repo/backend/confect/classroom/roster";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Order } from "effect";

/** The members a writer may mention, by name in the order of the language-neutral comparison, the writer left out. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.forum.people.list")(function* () {
    const { person } = yield* Member;
    const roster = yield* classRoster(yield* Class);
    return Arr.sort(
      Arr.map(
        Arr.filter(roster, (found) => found._id !== person._id),
        (found) => ({ id: found._id, name: found.name })
      ),
      Order.mapInput(Order.String, (found: { readonly name: string }) =>
        found.name.toLocaleLowerCase()
      )
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
