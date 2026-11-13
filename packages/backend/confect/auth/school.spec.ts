import { FunctionSpec, GroupSpec } from "@confect/core";
import { SchoolSignIn } from "@repo/backend/confect/auth/school";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The school login's sign-in (`auth/school`). The web app's sign-in route on a
 * school host forwards it, with the school that the host names.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "signIn",
    args: () => ({
      loginName: Schema.String,
      password: Schema.String,
      slug: TenantSlug,
    }),
    returns: () => SchoolSignIn,
  })
);
