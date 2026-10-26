import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import { decodedSteps, foldedText } from "@repo/backend/confect/editor/result";
import { snapshotOf, stepsThrough } from "@repo/backend/confect/editor/store";
import {
  placementOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

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
  const member = yield* Member;
  const { live } = yield* sittingGate
    .admit(
      rules.paper,
      member.person._id,
      Option.some(args.deviceId),
      placementOf({
        person: member.person,
        questionId: args.questionId,
        sittingId: args.sittingId,
        tenantId: member.tenant._id,
      })
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  return { prompt: yield* currentPrompt(live.question.prompt) };
});

/**
 * The text of a question's prompt as the document stands now: the editor's snapshot with every step
 * after it applied, or `FoldPending` while the steps do not reach the head, so no reader sees text
 * older than the last edit (ADR 0028). The student's paper and the proctor's view of a student's screen
 * read a prompt the same way.
 */
export const currentPrompt = Effect.fn("exams.sittings.prompt.current")(
  function* (documentId: ExamQuestionsDoc["prompt"]) {
    const promptDocument = yield* (yield* DatabaseReader)
      .table("editorDocuments")
      .get(documentId)
      .pipe(Effect.orDie);
    const snapshot = yield* snapshotOf(documentId);
    const rows = yield* stepsThrough(
      documentId,
      snapshot.version,
      promptDocument.head
    );
    if (rows.length < promptDocument.head - snapshot.version) {
      return yield* new FoldPending();
    }
    const steps = yield* decodedSteps(rows);
    const folded = yield* foldedText(documentId, snapshot, steps).pipe(
      Effect.orDie
    );
    return folded.content;
  }
);
