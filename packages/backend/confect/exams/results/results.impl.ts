import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { resultAccess } from "@repo/backend/confect/exams/results/authority";
import { mine } from "@repo/backend/confect/exams/results/mine";
import { overview } from "@repo/backend/confect/exams/results/overview";
import {
  byQuestion,
  questionStats,
} from "@repo/backend/confect/exams/results/questions";
import { grade } from "@repo/backend/confect/exams/results/grade";
import { release } from "@repo/backend/confect/exams/results/release";
import spec from "@repo/backend/confect/exams/results/results.spec";
import { byStudent } from "@repo/backend/confect/exams/results/students";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const overviewFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "overview",
  Effect.fn("exams.results.overview.function")(function* () {
    return yield* overview();
  })
);

const byStudentFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "byStudent",
  Effect.fn("exams.results.byStudent.function")(function* (args) {
    return yield* byStudent(args);
  })
);

const byQuestionFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "byQuestion",
  Effect.fn("exams.results.byQuestion.function")(function* (args) {
    return yield* byQuestion(args);
  })
);

const questionStatsFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "questionStats",
  Effect.fn("exams.results.questionStats.function")(function* (args) {
    return yield* questionStats(args);
  })
);

const releaseFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "release",
  Effect.fn("exams.results.release.function")(function* () {
    return yield* release();
  })
);

const gradeFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "grade",
  Effect.fn("exams.results.grade.function")(function* (args) {
    return yield* grade(args);
  })
);

const mineFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "mine",
  Effect.fn("exams.results.mine.function")(function* (args) {
    return yield* mine(args);
  })
);

/**
 * Implements the results group of `results.spec.ts`: the overview, the students' list, a question's
 * answers and statistics, a grade, the release, and a student's own released result.
 */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(overviewFunction),
  Layer.provide(byStudentFunction),
  Layer.provide(byQuestionFunction),
  Layer.provide(questionStatsFunction),
  Layer.provide(gradeFunction),
  Layer.provide(releaseFunction),
  Layer.provide(mineFunction),
  Layer.provide(Layer.mergeAll(session, member, resultAccess)),
  GroupImpl.finalize
);
