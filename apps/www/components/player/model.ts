import type {
  RenderableSpec,
  Selection,
} from "@repo/backend/confect/response/model";

/**
 * What the player knows of one question: enough to mark it in the navigator
 * and to answer it from the keyboard. A section numbers its questions from 1
 * in their frozen order, so the position of a question in the list is its
 * number.
 */
export interface PlayerQuestionModel {
  /** Saves a choice for this question; `null` clears it. */
  readonly answer: (selection: Selection | null) => void;
  readonly answered: boolean;
  /** The key that the store and the DOM name this question by. */
  readonly key: string;
  readonly responseSpec: RenderableSpec;
}
