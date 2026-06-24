import { valueInputSchema } from "@repo/math/schema/shared";
import { Schema } from "effect";

/** Distribution parameter fields accepted by the CAS request transport. */
export const probabilityParametersSchema = Schema.Struct({
  lambda: Schema.optional(valueInputSchema),
  lower: Schema.optional(valueInputSchema),
  mean: Schema.optional(valueInputSchema),
  n: Schema.optional(valueInputSchema),
  p: Schema.optional(valueInputSchema),
  standard_deviation: Schema.optional(valueInputSchema),
  upper: Schema.optional(valueInputSchema),
})
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Distribution parameters. Bernoulli uses p; binomial uses n and p; normal uses mean and standard_deviation; poisson uses lambda; uniform uses lower and upper.",
  });
