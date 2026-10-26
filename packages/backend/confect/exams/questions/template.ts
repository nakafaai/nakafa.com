import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { ensureRowSize } from "@repo/backend/confect/editor/document";
import { RevisionStale } from "@repo/backend/confect/exams/errors";
import {
  encodeAnswers,
  encodeKey,
  type QuestionTemplate,
  questionView,
} from "@repo/backend/confect/exams/question";
import { asTemplate } from "@repo/backend/confect/exams/template";
import { Clock, Effect } from "effect";

/**
 * Gives one question another template at the revision the editor saw: its answers take the
 * template's bounds and its key stays only when it still fits (`asTemplate`), and the revision
 * rises by one. A revision that is no longer current is refused as `RevisionStale` and writes
 * nothing, and the question's own template saves nothing.
 */
export const switchTemplate = Effect.fn("exams.question.template")(function* (
  question: ExamQuestionsDoc,
  edit: { readonly revision: number; readonly template: QuestionTemplate }
) {
  if (question.revision !== edit.revision) {
    return yield* new RevisionStale({ current: question.revision });
  }
  if (question.template === edit.template) {
    return;
  }
  const view = yield* questionView(question);
  const converted = asTemplate(edit.template, view.answers, view.key);
  const at = yield* Clock.currentTimeMillis;
  const answers = yield* encodeAnswers(converted.answers);
  const key = converted.key === null ? null : yield* encodeKey(converted.key);
  const revision = question.revision + 1;
  const fields = {
    answers,
    key,
    revision,
    template: edit.template,
    updatedAt: at,
  };
  yield* ensureRowSize({ ...question, ...fields });
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .patch(question._id, fields)
    .pipe(Effect.orDie);
});
