import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { gradeAuthority } from "@repo/backend/confect/records/authority";
import { gradeView } from "@repo/backend/confect/records/grade";
import spec from "@repo/backend/confect/records/grades.spec";
import { schemeOf } from "@repo/backend/confect/records/version";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The caller's own grade in the class, as a list of at most one. A grade the
 * caller may not read, such as a draft, is absent from the list. The read is
 * the caller's own row only, so no classmate's grade is ever loaded.
 */
export const mine = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("records.grades.mine")(function* () {
    const { person } = yield* Member;
    const row = yield* Class;
    const own = yield* (yield* DatabaseReader)
      .table("classGrades")
      .get("by_classId_and_personId", row._id, person._id)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
        Effect.orDie
      );
    if (Option.isNone(own)) {
      return [];
    }
    const actions = yield* gradeAuthority.allowed(own.value);
    if (!Arr.contains(actions, "grade.view")) {
      return [];
    }
    const scheme = yield* schemeOf(own.value.schemeId);
    return [gradeView(own.value, scheme)];
  })
);
