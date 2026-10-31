import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { releasedGradesOf } from "@repo/backend/confect/records/grades/released";
import spec from "@repo/backend/confect/records/grades.spec";
import { Effect } from "effect";

/**
 * The caller's own released grades in the school, of every class and period, newest period first. The read is the
 * caller's own rows only, so no classmate's grade is ever loaded, and a member who holds no grade reads none.
 */
export const own = FunctionImpl.make(
  databaseSchema,
  spec,
  "own",
  Effect.fn("records.grades.own")(function* () {
    const { person } = yield* Member;
    return yield* releasedGradesOf(person._id);
  })
);
