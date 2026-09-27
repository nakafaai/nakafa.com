import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
/** Shared public-safe user snapshot validator for joined response payloads. */
export const userDataValidator = Schema.Struct({
  _id: IdSchema("users"),
  name: Schema.String,
  email: Schema.String,
  image: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
