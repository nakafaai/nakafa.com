import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { CLASS_TEACHER_READ_LIMIT } from "@repo/backend/confect/classroom/class";
import spec from "@repo/backend/confect/classroom/classes.spec";
import { Period } from "@repo/backend/confect/tenancy/access";
import { Array as Arr, Effect } from "effect";

/**
 * The subject teachers of the classes a table of one period has loaded, each by name. A class of
 * another period names nobody, so the period's own access is the whole check. It reads one indexed
 * range for each class and one Person for each teacher, and the table asks once for all its rows.
 */
export const teachers = FunctionImpl.make(
  databaseSchema,
  spec,
  "teachers",
  Effect.fn("classroom.classes.teachers")(function* ({ classIds }) {
    const period = yield* Period;
    const reader = yield* DatabaseReader;

    return yield* Effect.forEach(
      classIds,
      (classId) =>
        Effect.gen(function* () {
          const rows = yield* reader
            .table("classTeachers")
            .index("by_classId_and_personId", (query) =>
              query.eq("classId", classId)
            )
            .take(CLASS_TEACHER_READ_LIMIT)
            .pipe(Effect.orDie);
          const people = yield* Effect.forEach(
            Arr.filter(rows, (row) => row.periodId === period._id),
            (row) =>
              reader.table("tenantPeople").get(row.personId).pipe(Effect.orDie),
            { concurrency: "unbounded" }
          );
          return { classId, names: Arr.map(people, (person) => person.name) };
        }),
      { concurrency: "unbounded" }
    );
  })
);
