import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import usersTable from "@repo/backend/confect/_generated/tables/users";
import Session from "@repo/backend/confect/middleware/session.spec";
import { UsernameCheck } from "@repo/backend/confect/users/username";
import { Schema } from "effect";

/** What anyone sees of an account on its public profile. */
const Profile = Schema.Struct({
  _id: IdSchema("users"),
  bio: usersTable.Doc.fields.bio,
  image: usersTable.Doc.fields.image,
  name: Schema.String,
  username: Schema.String,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserById",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.NullOr(usersTable.Doc),
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "getUserByAuthId",
      args: () => ({
        authId: Schema.String,
      }),
      returns: () => Schema.NullOr(usersTable.Doc),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "checkUsername",
      args: () => ({
        username: Schema.String,
      }),
      returns: () => UsernameCheck,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getProfileByUsername",
      args: () => ({
        username: Schema.String,
      }),
      returns: () => Schema.NullOr(Profile),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getUsernameById",
      args: () => ({
        userId: Schema.String,
      }),
      returns: () => Schema.NullOr(Schema.String),
    })
  );
