// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildTrustSourceExcerpt,
  type TrustLessonExcerpt,
} from "./trust-source";

const excerpt = {
  definition: "A sequence follows a repeated rule.",
  definitionHeading: "Sequence definition",
  foldsMath: "2^n",
  growthAfterYear: "years.",
  growthBeforeYear: "After",
  growthTerm: "exponential growth",
  heading: "Repeated growth",
  openingAfterFolds: "creates",
  openingBeforeFolds: "Folding",
  sequenceMath: "a_n = 2^n",
  yearMath: "n",
} satisfies TrustLessonExcerpt;

describe("buildTrustSourceExcerpt", () => {
  it("formats the localized trust excerpt as valid source Markdown", () => {
    expect(buildTrustSourceExcerpt(excerpt)).toBe(`## Repeated growth

Folding <InlineMath math="2^n" />creates **exponential growth**.

After <InlineMath math="n" />years.

## Sequence definition

A sequence follows a repeated rule.

<BlockMath math="a_n = 2^n" />`);
  });
});
