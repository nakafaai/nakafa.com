import { GenericId } from "@confect/core";
import { selfSelectableUserRoleSchema } from "@repo/backend/confect/modules/identity/users.tables";
import { Schema } from "effect";

/** Args accepted when a user updates their self-selected role. */
export const updateUserRoleArgsSchema = Schema.Struct({
  role: selfSelectableUserRoleSchema,
});

export type UpdateUserRoleArgs = typeof updateUserRoleArgsSchema.Type;

/** Args accepted when a user updates their profile name. */
export const updateUserNameArgsSchema = Schema.Struct({
  name: Schema.String,
});

export type UpdateUserNameArgs = typeof updateUserNameArgsSchema.Type;

/** Args accepted when internal callers read a user by app id. */
export const getUserByIdArgsSchema = Schema.Struct({
  userId: GenericId.GenericId("users"),
});

export type GetUserByIdArgs = typeof getUserByIdArgsSchema.Type;

/** Args accepted when internal callers read a user by Better Auth id. */
export const getUserByAuthIdArgsSchema = Schema.Struct({
  authId: Schema.String,
});

export type GetUserByAuthIdArgs = typeof getUserByAuthIdArgsSchema.Type;
