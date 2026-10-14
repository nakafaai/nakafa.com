import { Schema } from "effect";

/** One FAQ question and answer pair rendered on a marketing surface. */
const MarketingFaqItemSchema = Schema.Struct({
  answer: Schema.String,
  question: Schema.String,
});
export type MarketingFaqItem = typeof MarketingFaqItemSchema.Type;

/** Pricing FAQ numbers rendered on the dedicated pricing surface. */
export const pricingFaqNumbers = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
] as const;
