export interface TrustLessonExcerpt {
  readonly definition: string;
  readonly definitionHeading: string;
  readonly foldsMath: string;
  readonly growthAfterYear: string;
  readonly growthBeforeYear: string;
  readonly growthTerm: string;
  readonly heading: string;
  readonly openingAfterFolds: string;
  readonly openingBeforeFolds: string;
  readonly sequenceMath: string;
  readonly yearMath: string;
}

/** Projects the learner-facing excerpt into its canonical authored MDX form. */
export function buildTrustSourceExcerpt(excerpt: TrustLessonExcerpt) {
  return [
    `## ${excerpt.heading}`,
    "",
    `${excerpt.openingBeforeFolds} <InlineMath math="${excerpt.foldsMath}" />${excerpt.openingAfterFolds} **${excerpt.growthTerm}**.`,
    "",
    `${excerpt.growthBeforeYear} <InlineMath math="${excerpt.yearMath}" />${excerpt.growthAfterYear}`,
    "",
    `## ${excerpt.definitionHeading}`,
    "",
    excerpt.definition,
    "",
    `<BlockMath math="${excerpt.sequenceMath}" />`,
  ].join("\n");
}
