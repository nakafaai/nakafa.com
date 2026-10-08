import { Schema } from "effect";

export const NinaSuggestions = Schema.mutable(
  Schema.Array(
    Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(300))
  )
).check(Schema.isBetweenLength(1, 5));
