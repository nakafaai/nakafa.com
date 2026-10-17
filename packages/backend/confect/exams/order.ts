import type { GenericId } from "@confect/core";
import { Array as Arr, Option } from "effect";

/** The ID of one question, which is the ID of its row in `examQuestions`. */
type QuestionId = GenericId.GenericId<"examQuestions">;

/**
 * The order of the questions after one of them takes an index. The index counts the
 * questions without the moved one. An index past the end places the question last,
 * so a move that another teacher's add overtook still lands on the list's end.
 */
export const placeAt = (
  ids: readonly QuestionId[],
  id: QuestionId,
  index: number
): readonly QuestionId[] => {
  const rest = Arr.filter(ids, (candidate) => candidate !== id);
  const at = Math.min(index, rest.length);
  return [...Arr.take(rest, at), id, ...Arr.drop(rest, at)];
};

/**
 * The index a new question takes after `after`, or at the end when `after` is null.
 * It is none when `after` is not among the questions, so the caller refuses the add.
 */
export const insertIndex = (
  ids: readonly QuestionId[],
  after: QuestionId | null
): Option.Option<number> =>
  after === null
    ? Option.some(ids.length)
    : Option.map(
        Arr.findFirstIndex(ids, (candidate) => candidate === after),
        (index) => index + 1
      );
