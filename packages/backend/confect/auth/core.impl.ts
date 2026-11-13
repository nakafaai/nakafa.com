import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  completeSignInWithGoogle,
  isAuthenticated,
  refreshSession,
  signInWithUsernamePassword,
  signOut,
  startSignInWithGoogle,
} from "@repo/backend/confect/auth/core";
import spec from "@repo/backend/confect/auth/core.spec";
import { Layer } from "effect";

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(FunctionImpl.make(schema, spec, "signOut", signOut)),
  Layer.provide(
    FunctionImpl.make(schema, spec, "refreshSession", refreshSession)
  ),
  Layer.provide(
    FunctionImpl.make(schema, spec, "isAuthenticated", isAuthenticated)
  ),
  Layer.provide(
    FunctionImpl.make(
      schema,
      spec,
      "startSignInWithGoogle",
      startSignInWithGoogle
    )
  ),
  Layer.provide(
    FunctionImpl.make(
      schema,
      spec,
      "completeSignInWithGoogle",
      completeSignInWithGoogle
    )
  ),
  Layer.provide(
    FunctionImpl.make(
      schema,
      spec,
      "signInWithUsernamePassword",
      signInWithUsernamePassword
    )
  ),
  GroupImpl.finalize
);
