import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  onCreate,
  onDelete,
  onUpdate,
} from "@repo/backend/confect/modules/identity/auth.adapters";
import * as identity_auth from "@repo/backend/confect/modules/identity/auth.service";
import * as identity_cleanup from "@repo/backend/confect/modules/identity/cleanup.service";
import { Effect, Layer } from "effect";

const auth_getCurrentUserImpl = FunctionImpl.make(
  api,
  "auth",
  "getCurrentUser",
  (_args) => identity_auth.getCurrentUser()
);

const auth_getLatestJwksImpl = FunctionImpl.make(
  api,
  "auth",
  "getLatestJwks",
  (_args) => identity_auth.getLatestJwks()
);

const auth_getUserByIdImpl = FunctionImpl.make(
  api,
  "auth",
  "getUserById",
  (args) => identity_auth.getPublicUserById(args)
);

const auth_onCreateImpl = FunctionImpl.make(api, "auth", "onCreate", onCreate);

const auth_onDeleteImpl = FunctionImpl.make(api, "auth", "onDelete", onDelete);

const auth_onUpdateImpl = FunctionImpl.make(api, "auth", "onUpdate", onUpdate);

const auth_cleanup_cleanupDeletedUserImpl = FunctionImpl.make(
  api,
  "auth.cleanup",
  "cleanupDeletedUser",
  (args) =>
    identity_cleanup
      .cleanupDeletedUser(args)
      .pipe(
        Effect.catchTag("CleanupInvariantError", (error) => Effect.die(error))
      )
);

const authCleanupImpl = GroupImpl.make(api, "auth.cleanup").pipe(
  Layer.provide(auth_cleanup_cleanupDeletedUserImpl)
);

const authImpl = GroupImpl.make(api, "auth")
  .pipe(Layer.provide(authCleanupImpl))
  .pipe(Layer.provide(auth_getCurrentUserImpl))
  .pipe(Layer.provide(auth_getLatestJwksImpl))
  .pipe(Layer.provide(auth_getUserByIdImpl))
  .pipe(Layer.provide(auth_onCreateImpl))
  .pipe(Layer.provide(auth_onDeleteImpl))
  .pipe(Layer.provide(auth_onUpdateImpl));

export const authLayer = Layer.mergeAll(authImpl);
