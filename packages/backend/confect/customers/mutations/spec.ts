import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
/** Transactional outcome of attempting to persist one Polar customer. */
export const customerUpsertResultValidator = Schema.Union([
  Schema.Struct({
    customerId: IdSchema("customers"),
    kind: Schema.Literal("stored"),
  }),
  Schema.Struct({
    kind: Schema.Literal("deleted"),
  }),
  Schema.Struct({
    kind: Schema.Literal("missing"),
  }),
  Schema.Struct({
    kind: Schema.Literal("prepared"),
  }),
]);
export type CustomerUpsertResult = Schema.Schema.Type<
  typeof customerUpsertResultValidator
>;
