import { publicationReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const activationResultValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("activated"),
    receipt: publicationReceiptValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("completed"),
    receipt: publicationReceiptValidator,
  }),
]);
export type ActivationResult = Schema.Schema.Type<
  typeof activationResultValidator
>;
export const preparationResultValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("completed"),
  }),
  Schema.Struct({
    kind: Schema.Literal("prepared"),
  }),
]);
export type PreparationResult = Schema.Schema.Type<
  typeof preparationResultValidator
>;
