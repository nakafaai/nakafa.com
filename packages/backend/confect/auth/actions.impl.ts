import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/auth/actions.spec";
import { getLatestJwks } from "@repo/backend/confect/auth/jwks";
import { Layer } from "effect";
export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(schema, spec, "getLatestJwks", getLatestJwks)
  ),
  GroupImpl.finalize
);
