import {
  nonEmptyStringArraySchema,
  valueInputSchema,
} from "@repo/math/schema/shared";
import { Schema, Struct } from "effect";

const MathDiscreteValuesInputSchema = Schema.Struct({
  operation: Schema.Literals(["gcd", "lcm"]).annotate({
    description: "Compute a result from a list of integers.",
  }),
  values: nonEmptyStringArraySchema.annotate({
    description: "Integer values, for example [84, 30].",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathDiscreteIntegerInputSchema = Schema.Struct({
  n: valueInputSchema,
  operation: Schema.Literals(["is_prime", "prime_factorization"]).annotate({
    description: "Inspect one integer.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathDiscreteModularInputSchema = Schema.Struct({
  modulus: valueInputSchema,
  n: valueInputSchema,
  operation: Schema.Literal("modular").annotate({
    description: "Compute n modulo modulus.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MathDiscreteCountInputSchema = Schema.Struct({
  k: valueInputSchema,
  n: valueInputSchema,
  operation: Schema.Literals(["combination", "permutation"]).annotate({
    description: "Compute combinations or permutations from n and k.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export const MathDiscreteInputSchema = Schema.Union([
  MathDiscreteValuesInputSchema,
  MathDiscreteIntegerInputSchema,
  MathDiscreteModularInputSchema,
  MathDiscreteCountInputSchema,
]).annotate({
  description:
    "Discrete math and number theory tool input. Required fields depend on the selected operation.",
});
