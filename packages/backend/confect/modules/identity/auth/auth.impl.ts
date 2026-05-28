import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  onCreate,
  onDelete,
  onUpdate,
} from "@repo/backend/confect/modules/identity/auth/auth";
import {
  cleanupSyncedAuthUserRecord,
  createSyncedAuthUserRecord,
  updateSyncedAuthUserRecord,
} from "@repo/backend/confect/modules/identity/auth/triggers.service";
import {
  getCurrentUser as identityAuth_getCurrentUser,
  getLatestJwks as identityAuth_getLatestJwks,
  getPublicUserById as identityAuth_getPublicUserById,
} from "@repo/backend/confect/modules/identity/auth.service";
import { cleanupDeletedUser as identityCleanup_cleanupDeletedUser } from "@repo/backend/confect/modules/identity/cleanup.service";
import { Effect, Layer } from "effect";

const auth_getCurrentUserImpl = FunctionImpl.make(
  api,
  "auth",
  "getCurrentUser",
  (_args) => identityAuth_getCurrentUser()
);

const auth_getLatestJwksImpl = FunctionImpl.make(
  api,
  "auth",
  "getLatestJwks",
  (_args) => identityAuth_getLatestJwks()
);

const auth_getUserByIdImpl = FunctionImpl.make(
  api,
  "auth",
  "getUserById",
  (args) => identityAuth_getPublicUserById(args)
);

const auth_onCreateImpl = FunctionImpl.make(api, "auth", "onCreate", onCreate);

const auth_onDeleteImpl = FunctionImpl.make(api, "auth", "onDelete", onDelete);

const auth_onUpdateImpl = FunctionImpl.make(api, "auth", "onUpdate", onUpdate);

const auth_sync_createSyncedUserImpl = FunctionImpl.make(
  api,
  "auth.sync",
  "createSyncedUser",
  (args) => createSyncedAuthUserRecord(args)
);

const auth_sync_updateSyncedUserImpl = FunctionImpl.make(
  api,
  "auth.sync",
  "updateSyncedUser",
  (args) => updateSyncedAuthUserRecord(args)
);

const auth_sync_cleanupSyncedUserImpl = FunctionImpl.make(
  api,
  "auth.sync",
  "cleanupSyncedUser",
  (args) => cleanupSyncedAuthUserRecord(args)
);

const auth_cleanup_cleanupDeletedUserImpl = FunctionImpl.make(
  api,
  "auth.cleanup",
  "cleanupDeletedUser",
  (args) =>
    identityCleanup_cleanupDeletedUser(args).pipe(
      Effect.catchTag("CleanupInvariantError", (error) => Effect.die(error))
    )
);

const authCleanupImpl = GroupImpl.make(api, "auth.cleanup").pipe(
  Layer.provide(auth_cleanup_cleanupDeletedUserImpl)
);

const authSyncImpl = GroupImpl.make(api, "auth.sync")
  .pipe(Layer.provide(auth_sync_createSyncedUserImpl))
  .pipe(Layer.provide(auth_sync_updateSyncedUserImpl))
  .pipe(Layer.provide(auth_sync_cleanupSyncedUserImpl));

const authImpl = GroupImpl.make(api, "auth")
  .pipe(Layer.provide(authCleanupImpl))
  .pipe(Layer.provide(authSyncImpl))
  .pipe(Layer.provide(auth_getCurrentUserImpl))
  .pipe(Layer.provide(auth_getLatestJwksImpl))
  .pipe(Layer.provide(auth_getUserByIdImpl))
  .pipe(Layer.provide(auth_onCreateImpl))
  .pipe(Layer.provide(auth_onDeleteImpl))
  .pipe(Layer.provide(auth_onUpdateImpl));

export const authLayer = Layer.mergeAll(authImpl);
