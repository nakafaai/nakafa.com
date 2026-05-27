import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

const tryoutsQueriesMeSessionGroup = GroupSpec.make("session").addFunction(
  FunctionSpec.publicQuery({
    name: "getUserTryoutSession",
    args: Schema.Struct({
      attemptId: Schema.optional(Schema.String),
      locale: localeSchema,
      product: tryoutProductSchema,
      tryoutSlug: Schema.String,
    }),
    returns: Schema.Union(
      Schema.Null,
      Schema.Struct({
        attemptId: GenericId.GenericId("tryoutAttempts"),
        expiresAtMs: Schema.Number,
        status: Schema.Literal("in-progress", "completed", "expired"),
      })
    ),
  })
);

export { tryoutsQueriesMeSessionGroup };
