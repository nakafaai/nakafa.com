import { Array as Arr } from "effect";

/**
 * The number of edits between two words, where swapping two neighbouring letters
 * counts once (the optimal string alignment distance), or `budget + 1` when the
 * words are further apart than the budget. The palette forgives at most two
 * typing errors, so the search walks both words once and branches only at a
 * difference, at most four ways and two deep.
 */
export function editDistance(
  left: string,
  right: string,
  budget: number
): number {
  if (left === right) {
    return 0;
  }
  if (budget === 0 || Math.abs(left.length - right.length) > budget) {
    return budget + 1;
  }
  if (left === "" || right === "") {
    return Math.max(left.length, right.length);
  }
  if (left[0] === right[0]) {
    return editDistance(left.slice(1), right.slice(1), budget);
  }
  const swapped = left[0] === right[1] && left[1] === right[0];
  const edits = [
    editDistance(left.slice(1), right.slice(1), budget - 1),
    editDistance(left.slice(1), right, budget - 1),
    editDistance(left, right.slice(1), budget - 1),
    swapped ? editDistance(left.slice(2), right.slice(2), budget - 1) : budget,
  ];
  return Math.min(budget, ...edits) + 1;
}

/**
 * The fewest edits between a typed word and the start of a title's word, so a
 * word that is still being typed, such as "matematk", already finds
 * "matematika". The start is read one letter shorter and longer than the typed
 * word, since a missed or doubled letter changes its length.
 */
export function prefixDistance(typed: string, word: string, budget: number) {
  return Math.min(
    ...Arr.map([-1, 0, 1], (shift) =>
      editDistance(typed, word.slice(0, typed.length + shift), budget)
    )
  );
}
