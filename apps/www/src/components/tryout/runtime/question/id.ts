/** The DOM ids of one question: its anchor, the heading that names it, and its article. */
export function getTryoutQuestionIds(questionOrder: number) {
  const anchor = `question-${questionOrder}`;

  return {
    anchor,
    article: `exercise-${anchor}`,
    title: `${anchor}-title`,
  };
}
