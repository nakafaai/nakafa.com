import { Schema } from "effect";

/**
 * What the navigator shows of one question: its key, whether it is answered, and whether the learner
 * flagged it for review.
 */
export const PlayerCellModel = Schema.Struct({
  answered: Schema.Boolean,
  flagged: Schema.optionalKey(Schema.Boolean),
  /** The key that the store and the DOM name this question by. */
  key: Schema.String,
});
export type PlayerCellModel = typeof PlayerCellModel.Type;

/**
 * What the player knows of one question: enough to mark it in the navigator and to pick an option of it from the
 * keyboard. A section numbers its questions from 1 in their frozen order, so the position of a question in the
 * list is its number.
 */
export interface PlayerQuestionModel extends PlayerCellModel {
  /**
   * Picks the option at `index` of this question, the way the digit keys do. It answers `true` when the question
   * took the pick, and `false` when the question has no option at that index or takes no single choice.
   */
  readonly pick: (index: number) => boolean;
}
