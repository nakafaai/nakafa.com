import { Schema } from "effect";

/** One FAQ question and answer pair rendered on a marketing surface. */
const MarketingFaqItemSchema = Schema.Struct({
  answer: Schema.String,
  question: Schema.String,
});
export type MarketingFaqItem = typeof MarketingFaqItemSchema.Type;

/**
 * Pricing FAQ numbers rendered on the dedicated pricing surface, in the order
 * of the design: the credits first, then Pro, then the free plan.
 */
export const pricingFaqNumbers = [
  9, 10, 11, 12, 13, 14, 15, 16, 17, 6,
] as const;
