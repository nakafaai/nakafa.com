// @vitest-environment node

import { readFile } from "node:fs/promises";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import english from "@repo/internationalization/dictionaries/en.json";
import indonesian from "@repo/internationalization/dictionaries/id.json";
import { describe, expect, it } from "vitest";

import {
  buildTrustSourceExcerpt,
  type TrustLessonExcerpt,
} from "./trust-source";

const canonicalLessonRoot = new URL(
  "../../../../../packages/contents/material/lesson/mathematics/exponential-logarithm/basic-concept/",
  import.meta.url
);

const excerptCases = [
  {
    excerpt: {
      definition: english.TrustSection["lesson-definition"],
      definitionHeading: english.TrustSection["lesson-definition-heading"],
      foldsMath: english.TrustSection["lesson-folds-math"],
      growthAfterYear: english.TrustSection["lesson-growth-after-year"],
      growthBeforeYear: english.TrustSection["lesson-growth-before-year"],
      growthTerm: english.TrustSection["lesson-growth-term"],
      heading: english.TrustSection["lesson-heading"],
      openingAfterFolds: english.TrustSection["lesson-opening-after-folds"],
      openingBeforeFolds: english.TrustSection["lesson-opening-before-folds"],
      sequenceMath: english.TrustSection["lesson-sequence-math"],
      yearMath: english.TrustSection["lesson-year-math"],
    },
    locale: "en",
  },
  {
    excerpt: {
      definition: indonesian.TrustSection["lesson-definition"],
      definitionHeading: indonesian.TrustSection["lesson-definition-heading"],
      foldsMath: indonesian.TrustSection["lesson-folds-math"],
      growthAfterYear: indonesian.TrustSection["lesson-growth-after-year"],
      growthBeforeYear: indonesian.TrustSection["lesson-growth-before-year"],
      growthTerm: indonesian.TrustSection["lesson-growth-term"],
      heading: indonesian.TrustSection["lesson-heading"],
      openingAfterFolds: indonesian.TrustSection["lesson-opening-after-folds"],
      openingBeforeFolds:
        indonesian.TrustSection["lesson-opening-before-folds"],
      sequenceMath: indonesian.TrustSection["lesson-sequence-math"],
      yearMath: indonesian.TrustSection["lesson-year-math"],
    },
    locale: "id",
  },
] satisfies ReadonlyArray<{
  excerpt: TrustLessonExcerpt;
  locale: ContentLocale;
}>;

/** Reads the matching authored excerpt from the canonical lesson MDX. */
async function readCanonicalExcerpt(locale: ContentLocale) {
  const source = await readFile(
    new URL(`${locale}.mdx`, canonicalLessonRoot),
    "utf8"
  );
  const excerptStart = source.indexOf("## ");
  const blockStart = source.indexOf("<BlockMath", excerptStart);
  const excerptEnd = source.indexOf(" />", blockStart);

  if (excerptStart < 0 || blockStart < 0 || excerptEnd < 0) {
    throw new Error(`Could not locate the canonical ${locale} trust excerpt`);
  }

  return source.slice(excerptStart, excerptEnd + 3);
}

/** Normalizes authored line wrapping without changing visible content. */
function normalizeExcerpt(source: string) {
  return source.replace(/\s+/g, " ").trim();
}

describe("buildTrustSourceExcerpt", () => {
  it.each(excerptCases)(
    "stays synchronized with the canonical $locale lesson",
    async ({ excerpt, locale }) => {
      const canonicalExcerpt = await readCanonicalExcerpt(locale);

      expect(normalizeExcerpt(buildTrustSourceExcerpt(excerpt))).toBe(
        normalizeExcerpt(canonicalExcerpt)
      );
    }
  );
});
