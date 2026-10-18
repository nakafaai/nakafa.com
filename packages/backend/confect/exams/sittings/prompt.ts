import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import { decodedSteps, foldedText } from "@repo/backend/confect/editor/result";
import { snapshotOf, stepsThrough } from "@repo/backend/confect/editor/store";
import {
  boundAttempt,
  requireOpen,
} from "@repo/backend/confect/exams/sittings/attempt";
import { QuestionNotInExam } from "@repo/backend/confect/exams/sittings/errors";
import { Array as Arr, Clock, Effect } from "effect";

/**
 * The prompt of one question of the caller's paper, as the document stands now: the editor's
 * snapshot with every step after it applied. The steps come as the editor's open reads them,
 * with `take` up to the head, which a fold keeps within one read and one batch; a page would
 * replay its first end in the student's subscription and fail once a fold moves the snapshot.
 * Steps that do not reach the head are refused as `FoldPending`, so a student never reads
 * text older than the last edit (ADR 0028). Only the bound device of an open attempt reads a
 * prompt, and only a question of the sitting's exam.
 */
export const prompt = Effect.fn("exams.sittings.prompt")(function* (args: {
  deviceId: string;
  questionId: ExamQuestionsDoc["_id"];
  sittingId: ExamSittingsDoc["_id"];
}) {
  const { attempt, sitting } = yield* boundAttempt(
    args.sittingId,
    args.deviceId
  );
  yield* requireOpen(attempt, yield* Clock.currentTimeMillis);
  if (!Arr.contains(sitting.exam.questions, args.questionId)) {
    return yield* new QuestionNotInExam();
  }
  const reader = yield* DatabaseReader;
  const question = yield* reader
    .table("examQuestions")
    .get(args.questionId)
    .pipe(Effect.orDie);
  const promptDocument = yield* reader
    .table("editorDocuments")
    .get(question.prompt)
    .pipe(Effect.orDie);
  const snapshot = yield* snapshotOf(question.prompt);
  const rows = yield* stepsThrough(
    question.prompt,
    snapshot.version,
    promptDocument.head
  );
  if (rows.length < promptDocument.head - snapshot.version) {
    return yield* new FoldPending();
  }
  const steps = yield* decodedSteps(rows);
  const folded = yield* foldedText(question.prompt, snapshot, steps).pipe(
    Effect.orDie
  );
  return { prompt: folded.content };
});
