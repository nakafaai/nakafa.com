import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  admitGoogleSignIn,
  createGoogleAccount,
  refuseSchoolSignUp,
} from "@repo/backend/confect/auth/account";
import spec from "@repo/backend/confect/auth/account.spec";
import { Layer } from "effect";

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(schema, spec, "createGoogle", createGoogleAccount)
  ),
  Layer.provide(
    FunctionImpl.make(schema, spec, "signInGoogle", admitGoogleSignIn)
  ),
  Layer.provide(
    FunctionImpl.make(schema, spec, "createSchool", refuseSchoolSignUp)
  ),
  GroupImpl.finalize
);
