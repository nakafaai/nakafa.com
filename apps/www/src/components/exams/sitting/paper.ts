import type { OptimisticLocalStore } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { PaperView } from "@repo/backend/confect/exams/sittings/contract";
import type { ExamResponse } from "@repo/backend/confect/exams/sittings/response";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";

/** The paper of a student's open attempt, as the server reads it. */
export type PaperValue = typeof PaperView.Type;

/** One question of the paper, with its interactions and its saved response. */
export type PaperQuestion = PaperValue["questions"][number];

/**
 * The paper with the response of one question replaced, numbered with `version`. The screen shows a chosen
 * option or typed text with this change at once. The server's answer then replaces it, and a refused answer rolls it back.
 */
export function setPaperResponse(
  paper: PaperValue,
  questionId: PaperQuestion["id"],
  response: ExamResponse,
  version: number
): PaperValue {
  return {
    questions: Arr.map(paper.questions, (question) =>
      question.id === questionId ? { ...question, response, version } : question
    ),
  };
}

/** The paper with one question flagged or unflagged. The screen shows the flag at once, and a refused flag rolls it back. */
export function setPaperFlag(
  paper: PaperValue,
  questionId: PaperQuestion["id"],
  flagged: boolean
): PaperValue {
  return {
    questions: Arr.map(paper.questions, (question) =>
      question.id === questionId ? { ...question, flagged } : question
    ),
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
 * Replaces the paper that the local store holds for one student with `change` of it, when the store holds
 * it, so an answer or a flag shows at once and Convex rolls it back when the server refuses the call.
 */
export function changePaper(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof PaperKey.Type,
  change: (paper: PaperValue) => PaperValue
) {
  const args = {
    deviceId: key.deviceId,
    sittingId: key.sittingId,
    slug: key.slug,
  };
  const current = Option.getOrUndefined(
    localStore.getQuery(exams.sittings.paper, args)
  );
  if (current !== undefined) {
    localStore.setQuery(
      exams.sittings.paper,
      args,
      Option.some(change(current))
    );
  }
}
