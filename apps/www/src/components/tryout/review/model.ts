import { verdictOf } from "@repo/backend/confect/assessment/verdict";
import { Array as Arr } from "effect";
import type {
  PlayerReviewCellModel,
  PlayerVerdict,
} from "@/components/player/model";
import type { TryoutBody } from "@/components/tryout/content/body";
import { isAnsweredQuestion } from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

/**
 * How a finished question reads in its review: unanswered, its grade's verdict, or answered when its grade
 * is not the reader's to see, since the backend sends a grade only to a reader who may read it.
 */
export function verdictOfQuestion(
  question: TryoutRuntimeQuestion
): PlayerVerdict {
  if (!isAnsweredQuestion(question)) {
    return "unanswered";
  }
  const grade = question.response?.grade;
  return grade === undefined ? "answered" : verdictOf(grade);
}

/**
 * Whether a reader may read a finished section whole: every question carries its key, which the backend
 * sends only to a reader who may read it. Any other reader sees the leading preview under the Pro offer.
 */
export function readsWhole(bodies: readonly TryoutBody[]) {
  return Arr.every(bodies, (body) => body.key !== undefined);
}

/**
 * The numbers of a finished section's navigator, in question order: each question's verdict. The review
 * shows every question, so every number opens its own.
 */
export function reviewCellsOf(
  questions: readonly TryoutRuntimeQuestion[]
): readonly PlayerReviewCellModel[] {
  return Arr.map(questions, (question) => ({
    key: question.placementId,
    shown: true,
    verdict: verdictOfQuestion(question),
  }));
}
