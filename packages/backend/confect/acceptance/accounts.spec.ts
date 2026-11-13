import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { Schema } from "effect";

/**
 * The acceptance seeds of a synthetic account that a browser test signs in to,
 * and of its profile (`acceptance/account`). It is internal, so only the acceptance command line
 * calls it, with the local deployment's key.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "create",
      args: () => ({ email: Schema.String, name: Schema.String }),
      returns: () =>
        Schema.Struct({ password: Schema.String, userId: Id("users") }),
      error: () => SeedRefused,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "profile",
      args: () => ({
        image: Schema.optionalKey(Schema.String),
        name: Schema.optionalKey(Schema.String),
        userId: Id("users"),
      }),
      returns: () => Schema.Null,
      error: () => SeedRefused,
    })
  );
