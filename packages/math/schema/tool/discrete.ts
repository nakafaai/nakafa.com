import {
  nonEmptyStringArraySchema,
  valueInputSchema,
} from "@repo/math/schema/shared";
import { Schema } from "effect";

const MathDiscreteValuesInputSchema = Schema.Struct({
  operation: Schema.Literal("gcd", "lcm").annotations({
    description: "Compute a result from a list of integers.",
  }),
  values: nonEmptyStringArraySchema.annotations({
    description: "Integer values, for example [84, 30].",
  }),
}).pipe(Schema.mutable);

const MathDiscreteIntegerInputSchema = Schema.Struct({
  n: valueInputSchema,
  operation: Schema.Literal("is_prime", "prime_factorization").annotations({
    description: "Inspect one integer.",
  }),
}).pipe(Schema.mutable);

const MathDiscreteModularInputSchema = Schema.Struct({
  modulus: valueInputSchema,
  n: valueInputSchema,
  operation: Schema.Literal("modular").annotations({
    description: "Compute n modulo modulus.",
  }),
}).pipe(Schema.mutable);

const MathDiscreteCountInputSchema = Schema.Struct({
  k: valueInputSchema,
  n: valueInputSchema,
  operation: Schema.Literal("combination", "permutation").annotations({
    description: "Compute combinations or permutations from n and k.",
  }),
}).pipe(Schema.mutable);

export const MathDiscreteInputSchema = Schema.Union(
  MathDiscreteValuesInputSchema,
  MathDiscreteIntegerInputSchema,
  MathDiscreteModularInputSchema,
  MathDiscreteCountInputSchema
)
  .pipe(Schema.mutable)
  .annotations({
    description:
      "Discrete math and number theory tool input. Required fields depend on the selected operation.",
  });
