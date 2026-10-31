import type { OptimisticLocalStore } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import type {
  PaperView,
  SavedView,
} from "@repo/backend/confect/exams/sittings/contract";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, HashMap, Option, Schema, Tuple } from "effect";

/** What a student saved on the paper of an open attempt, as the server reads it. */
export type SavedValue = typeof SavedView.Type;

/** One question of the server's paper, as the query answers it. */
type ServerQuestion = (typeof PaperView.Type)["questions"][number];

/** One saved answer, as the student's saved query answers it. */
type SavedAnswer = SavedValue["answers"][number];

/** A question of the server's paper with what the student saved on it. */
const withSaved = (
  question: ServerQuestion,
  answer: Option.Option<SavedAnswer>,
  flagged: boolean
) => ({
  ...question,
  flagged,
  response: Option.match(answer, {
    onNone: () => null,
    onSome: (found) => found.response,
  }),
  version: Option.match(answer, {
    onNone: () => null,
    onSome: (found) => found.version,
  }),
});

/**
 * The question each server question last merged to. An answer names one version, so a question keeps its object
 * while its version and its flag stand, and an answer redraws its own question and not the other thirty-nine.
 */
const mergedQuestions = new WeakMap<
  ServerQuestion,
  ReturnType<typeof withSaved>
>();

/** One question merged with what the student saved on it, the same object as long as nothing on it moved. */
function mergeQuestion(
  question: ServerQuestion,
  answer: Option.Option<SavedAnswer>,
  flagged: boolean
) {
  const merged = withSaved(question, answer, flagged);
  const kept = mergedQuestions.get(question);
  if (
    kept !== undefined &&
    kept.version === merged.version &&
    kept.flagged === merged.flagged
  ) {
    return kept;
  }
  mergedQuestions.set(question, merged);
  return merged;
}

/**
 * The paper as the student sees it: each question of the server's paper, with the response and
 * version that the student saved for it, or `null` when none is saved, and whether it is flagged.
 * The two come from separate queries, so an answer reads again only what the student saved.
 */
export function mergePaper(paper: typeof PaperView.Type, saved: SavedValue) {
  const answers = HashMap.fromIterable(
    Arr.map(saved.answers, (answer) => Tuple.make(answer.question, answer))
  );
  return {
    questions: Arr.map(paper.questions, (question) =>
      mergeQuestion(
        question,
        HashMap.get(answers, question.id),
        Arr.contains(saved.flagged, question.id)
      )
    ),
  };
}

/** The paper of a student's open attempt, with what the student saved on it. */
export type PaperValue = ReturnType<typeof mergePaper>;

/** One question of the paper, with its interactions and its saved response. */
export type PaperQuestion = PaperValue["questions"][number];

/**
 * What the student saved with the response of one question replaced, numbered with `version`. The screen shows
 * a chosen option or typed text with this change at once. The server's answer then replaces it, and a refused
 * answer rolls it back.
 */
export function setSavedResponse(
  saved: SavedValue,
  questionId: PaperQuestion["id"],
  response: ExamResponse,
  version: number
): SavedValue {
  return {
    answers: Arr.append(
      Arr.filter(saved.answers, (answer) => answer.question !== questionId),
      { question: questionId, response, version }
    ),
    flagged: saved.flagged,
  };
}

/** What the student saved with one question flagged or unflagged. The screen shows the flag at once, and a refused flag rolls it back. */
export function setSavedFlag(
  saved: SavedValue,
  questionId: PaperQuestion["id"],
  flagged: boolean
): SavedValue {
  const others = Arr.filter(saved.flagged, (id) => id !== questionId);
  return {
    answers: saved.answers,
    flagged: flagged ? Arr.append(others, questionId) : others,
  };
}

/**
 * The version that the next answer of a question is numbered with: one above the saved version, and the first
 * version for a question that holds no saved answer (ADR 0013).
 */
export function nextVersionOf(question: PaperQuestion) {
  return (question.version ?? 0) + 1;
}

/** The key of one student's paper: the device that holds the attempt, and its sitting. */
const PaperKey = Schema.Struct({
  deviceId: Schema.String,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/**
 * Replaces what the local store holds as saved for one student with `change` of it, when the store holds it,
 * so an answer or a flag shows at once and Convex rolls it back when the server refuses the call. The paper
 * itself is never touched, so no answer reads it again.
 */
export function changeSaved(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof PaperKey.Type,
  change: (saved: SavedValue) => SavedValue
) {
  const args = {
    deviceId: key.deviceId,
    sittingId: key.sittingId,
    slug: key.slug,
  };
  const current = Option.getOrUndefined(
    localStore.getQuery(exams.sittings.saved, args)
  );
  if (current !== undefined) {
    localStore.setQuery(
      exams.sittings.saved,
      args,
      Option.some(change(current))
    );
  }
}
