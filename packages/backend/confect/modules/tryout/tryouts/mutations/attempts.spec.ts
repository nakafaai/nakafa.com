import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

const tryoutsMutationsAttemptsGroup = GroupSpec.make("attempts")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "completePart",
      args: Schema.Struct({
        partKey: Schema.String,
        tryoutAttemptId: GenericId.GenericId("tryoutAttempts"),
      }),
      returns: Schema.Union(
        Schema.Struct({ kind: Schema.Literal("completed") }),
        Schema.Struct({ kind: Schema.Literal("tryout-expired") })
      ),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startPart",
      args: Schema.Struct({
        partKey: Schema.String,
        tryoutAttemptId: GenericId.GenericId("tryoutAttempts"),
      }),
      returns: Schema.Union(
        Schema.Struct({ kind: Schema.Literal("started") }),
        Schema.Struct({ kind: Schema.Literal("tryout-expired") }),
        Schema.Struct({ kind: Schema.Literal("part-expired") })
      ),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startTryout",
      args: Schema.Struct({
        locale: localeSchema,
        product: tryoutProductSchema,
        tryoutSlug: Schema.String,
      }),
      returns: Schema.Union(
        Schema.Struct({ kind: Schema.Literal("started") }),
        Schema.Struct({ kind: Schema.Literal("competition-attempt-used") }),
        Schema.Struct({ kind: Schema.Literal("requires-access") }),
        Schema.Struct({ kind: Schema.Literal("not-ready") }),
        Schema.Struct({ kind: Schema.Literal("not-found") }),
        Schema.Struct({ kind: Schema.Literal("inactive") })
      ),
    })
  );

export { tryoutsMutationsAttemptsGroup };
