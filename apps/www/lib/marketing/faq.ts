/** One FAQ question and answer pair rendered on a marketing surface. */
export interface MarketingFaqItem {
  answer: string;
  question: string;
}

/**
 * FAQ numbers rendered by each marketing surface, in display order.
 *
 * A number pairs `q{n}` with `a{n}` in the surface's message namespace, so the
 * visible section and its structured data can read one list instead of two.
 */
export const landingFaqNumbers = [1, 2, 4, 5, 6, 7] as const;

/** Pricing FAQ numbers rendered on the dedicated pricing surface. */
export const pricingFaqNumbers = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const;
