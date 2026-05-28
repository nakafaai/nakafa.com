import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { tryoutStatusSchema } from "@repo/backend/confect/modules/tryout/tryouts.tables";
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
        status: tryoutStatusSchema,
      })
    ),
  })
);

export { tryoutsQueriesMeSessionGroup };
