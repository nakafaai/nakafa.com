import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Exam } from "@repo/backend/confect/exams/access";
import {
  authorizeScope,
  examAccess,
  examAuthority,
} from "@repo/backend/confect/exams/authority";
import { examSummary } from "@repo/backend/confect/exams/exam";
import spec from "@repo/backend/confect/exams/exams.spec";
import { addQuestion } from "@repo/backend/confect/exams/questions/place";
import { readQuestion } from "@repo/backend/confect/exams/questions/read";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Clock, Effect, Layer, Struct } from "effect";

/**
 * Creates an exam in a scope the caller may edit, with its first question, so an
 * exam is never empty. The exam starts with no question, and the question is added
 * to it in the same transaction.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("exams.create")(function* ({ language, scope, title }) {
    const { tenant } = yield* Member;
    const { appUser } = yield* requireAuth().pipe(Effect.orDie);
    yield* authorizeScope(scope);
    const at = yield* Clock.currentTimeMillis;
    const examId = yield* (yield* DatabaseWriter)
      .table("exams")
      .insert({
        createdAt: at,
        createdBy: appUser._id,
        language,
        questions: [],
        scope,
        tenantId: tenant._id,
        title,
      })
      .pipe(Effect.orDie);
    // A new exam holds no question, so its first question cannot be refused as full
    // or placed after a question it does not hold. Those refusals are defects here.
    yield* addQuestion(
      { _id: examId, questions: [], scope, tenantId: tenant._id },
      null
    ).pipe(
      Effect.catchTags({ AccessDenied: Effect.die, ExamFull: Effect.die })
    );
    return { id: examId };
  })
);

/**
 * One page of the exams of the school, newest first. The index reads the school's
 * exams in order, and each one is kept only if the caller may view it, so a scoped
 * Teacher sees the tenant's exams of their unit and no other unit's.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("exams.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("exams")
      .index("by_tenantId", (query) => query.eq("tenantId", tenant._id), "desc")
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const viewable = yield* Effect.filter(page.page, (row) =>
      examAuthority
        .allowed(row)
        .pipe(Effect.map((actions) => Arr.contains(actions, "exam.view")))
    );
    return Struct.assign(page, { page: Arr.map(viewable, examSummary) });
  })
);

/** One exam with its questions in order. Each question is one small row, and the exam holds at most the limit of them. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("exams.open")(function* () {
    const exam = yield* Exam;
    const questions = yield* Effect.forEach(exam.questions, (questionId) =>
      readQuestion(questionId)
    );
    return {
      id: exam._id,
      language: exam.language,
      questions,
      title: exam.title,
    };
  })
);

/** Renames an exam. Its scope, language, and questions stay as they are. */
const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("exams.rename")(function* ({ title }) {
    const exam = yield* Exam;
    yield* (yield* DatabaseWriter)
      .table("exams")
      .patch(exam._id, { title })
      .pipe(Effect.orDie);
    return { id: exam._id, language: exam.language, title };
  })
);

/** Implements the exams group of `exams.spec.ts`: create, list, open, and rename. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(create),
  Layer.provide(list),
  Layer.provide(open),
  Layer.provide(rename),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
