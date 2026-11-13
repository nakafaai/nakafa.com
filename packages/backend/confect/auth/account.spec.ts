import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountDeleted,
  GoogleAddressRefused,
  GoogleMethod,
  SchoolMethod,
  SchoolSignUpRefused,
} from "@repo/backend/confect/auth/account";
import { Schema } from "effect";

/**
 * The user callbacks of Convex Auth's sign-in methods (`auth/core`). Convex Auth
 * calls them by function handle inside its own sign-in transaction, so a
 * failure here refuses the sign-in and rolls back the account it made.
 * https://docs.convex.dev/auth/convex-auth/best-practices
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createGoogle",
      args: () => ({ method: GoogleMethod }),
      returns: () => Id("users"),
      error: () => GoogleAddressRefused,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "signInGoogle",
      args: () => ({ method: GoogleMethod, userId: Id("users") }),
      returns: () => Schema.Null,
      error: () => AccountDeleted,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "createSchool",
      args: () => ({ method: SchoolMethod }),
      returns: () => Id("users"),
      error: () => SchoolSignUpRefused,
    })
  );
