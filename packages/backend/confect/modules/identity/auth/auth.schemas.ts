import { Schema } from "effect";

const jwksKeyValueSchema = Schema.Union(
  Schema.Null,
  Schema.Boolean,
  Schema.Number,
  Schema.String,
  Schema.Array(Schema.String)
);

const jwksKeySchema = Schema.Record({
  key: Schema.String,
  value: jwksKeyValueSchema,
});

/** JSON Web Key Set payload returned by Better Auth. */
export const jwksSchema = Schema.Struct({
  keys: Schema.Array(jwksKeySchema),
});
