import { FunctionSpec, GroupSpec } from "@confect/core";
import type { getLatestJwks } from "@repo/backend/confect/auth/jwks";
/** Better Auth owns the administrative JWKS payload and its validator. */
export default GroupSpec.make().addFunction(
  FunctionSpec.convexInternalAction<typeof getLatestJwks>()("getLatestJwks")
);
