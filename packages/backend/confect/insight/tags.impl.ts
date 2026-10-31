import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Exam } from "@repo/backend/confect/exams/access";
import { examAccess } from "@repo/backend/confect/exams/authority";
import spec from "@repo/backend/confect/insight/tags.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The tag of one question, if it has one. */
const tagOf = (questionId: GenericId.GenericId<"examQuestions">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("insightTags")
      .index("by_questionId", (query) => query.eq("questionId", questionId))
      .first()
      .pipe(Effect.orDie)
  );

/** The exam's questions in their order, each with its number and the competency it tells of. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("insight.tags.list")(function* () {
    const exam = yield* Exam;
    return yield* Effect.forEach(
      Arr.map(exam.questions, (id, index) => ({ id, number: index + 1 })),
      ({ id, number }) =>
        Effect.map(tagOf(id), (tag) => ({
          competency: Option.getOrNull(
            Option.map(tag, (found) => found.competency)
          ),
          id,
          number,
        }))
    );
  })
);

/** Names the competency of one question of the exam, or takes it away. A question of another exam changes nothing. */
const set = FunctionImpl.make(
  databaseSchema,
  spec,
  "set",
  Effect.fn("insight.tags.set")(function* ({ competency, questionId }) {
    const exam = yield* Exam;
    if (!Arr.contains(exam.questions, questionId)) {
      return null;
    }
    const writer = yield* DatabaseWriter;
    const tag = yield* tagOf(questionId);
    if (competency === null) {
      if (Option.isSome(tag)) {
        yield* writer
          .table("insightTags")
          .delete(tag.value._id)
          .pipe(Effect.orDie);
      }
      return null;
    }
    yield* Option.match(tag, {
      onNone: () =>
        writer.table("insightTags").insert({
          competency,
          examId: exam._id,
          questionId,
          tenantId: exam.tenantId,
        }),
      onSome: (found) =>
        writer.table("insightTags").patch(found._id, { competency }),
    }).pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(set),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
