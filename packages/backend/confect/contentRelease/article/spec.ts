import { Schema } from "effect";

/** Bounded article taxonomy returned to the protected agent transport. */
export const agentArticleTaxonomyValidator = Schema.Struct({
  categories: Schema.mutable(Schema.Array(Schema.String)),
  managed: Schema.Boolean,
});
