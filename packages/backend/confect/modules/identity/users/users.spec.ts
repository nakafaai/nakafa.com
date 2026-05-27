import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const usersMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserRole",
      args: Schema.Struct({
        role: Schema.Literal("teacher", "student", "parent"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserName",
      args: Schema.Struct({ name: Schema.String }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "syncUserInfoForChat",
      args: Schema.Struct({}),
      returns: Schema.Struct({
        credits: Schema.Number,
        role: Schema.Union(
          Schema.Null,
          Schema.Union(
            Schema.Null,
            Schema.Literal("teacher", "student", "parent", "administrator")
          )
        ),
        userId: GenericId.GenericId("users"),
      }),
    })
  );

export { usersMutationsGroup };

const usersQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserById",
      args: Schema.Struct({ userId: GenericId.GenericId("users") }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("users"),
          authId: Schema.String,
          credits: Schema.Number,
          creditsResetAt: Schema.Number,
          email: Schema.String,
          image: Schema.optional(Schema.String),
          name: Schema.String,
          plan: Schema.Literal("free", "pro"),
          role: Schema.optional(
            Schema.Literal("teacher", "student", "parent", "administrator")
          ),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserByAuthId",
      args: Schema.Struct({ authId: Schema.String }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("users"),
          authId: Schema.String,
          credits: Schema.Number,
          creditsResetAt: Schema.Number,
          email: Schema.String,
          image: Schema.optional(Schema.String),
          name: Schema.String,
          plan: Schema.Literal("free", "pro"),
          role: Schema.optional(
            Schema.Literal("teacher", "student", "parent", "administrator")
          ),
        })
      ),
    })
  );

export { usersQueriesGroup };

const usersGroup = GroupSpec.make("users")
  .addGroup(usersMutationsGroup)
  .addGroup(usersQueriesGroup);

export { usersGroup };
