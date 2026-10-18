import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { gradeView } from "@repo/backend/confect/records/grade";
import spec from "@repo/backend/confect/records/grades.spec";
import { schemeOf } from "@repo/backend/confect/records/version";
import { Effect, Struct } from "effect";

/**
 * One page of a class's grades, drafts included, in the order of their students.
 * Each grade is judged by the scheme it names, so the page reads that scheme once
 * per grade and nothing else.
 */
export const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("records.grades.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const page = yield* (yield* DatabaseReader)
      .table("classGrades")
      .index("by_classId_and_personId", (query) => query.eq("classId", row._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const views = yield* Effect.forEach(
      page.page,
      (grade) =>
        Effect.map(schemeOf(grade.schemeId), (scheme) =>
          gradeView(grade, scheme)
        ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: views });
  })
);
