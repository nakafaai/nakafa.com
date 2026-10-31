/**
 * The DOM ids of one question, from its number: its anchor, the heading that names it, and its article.
 * A page holds one paper, so its numbers name its questions, in the player and in a review alike.
 */
export function readQuestionIds(number: number) {
  const anchor = `question-${number}`;

  return {
    anchor,
    article: `exercise-${anchor}`,
    title: `${anchor}-title`,
  };
}
