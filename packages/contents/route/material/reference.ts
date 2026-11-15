import { Schema } from "effect";

const MaterialContextIdentitySchema = Schema.Struct({
  nodeKey: Schema.String,
  programKey: Schema.String,
});
export type MaterialContextIdentity = typeof MaterialContextIdentitySchema.Type;
