import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  getUserByAuthId as identityUsers_getUserByAuthId,
  getUserById as identityUsers_getUserById,
  syncUserInfoForChat as identityUsers_syncUserInfoForChat,
  updateUserName as identityUsers_updateUserName,
  updateUserRole as identityUsers_updateUserRole,
} from "@repo/backend/confect/modules/identity/users.service";
import { Effect, Layer } from "effect";

const users_mutations_updateUserRoleImpl = FunctionImpl.make(
  api,
  "users.mutations",
  "updateUserRole",
  (args) =>
    identityUsers_updateUserRole(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const users_mutations_updateUserNameImpl = FunctionImpl.make(
  api,
  "users.mutations",
  "updateUserName",
  (args) =>
    identityUsers_updateUserName(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const users_mutations_syncUserInfoForChatImpl = FunctionImpl.make(
  api,
  "users.mutations",
  "syncUserInfoForChat",
  (_args) =>
    identityUsers_syncUserInfoForChat().pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
      Effect.orDie
    )
);

const users_queries_getUserByIdImpl = FunctionImpl.make(
  api,
  "users.queries",
  "getUserById",
  (args) => identityUsers_getUserById(args).pipe(Effect.orDie)
);

const users_queries_getUserByAuthIdImpl = FunctionImpl.make(
  api,
  "users.queries",
  "getUserByAuthId",
  (args) => identityUsers_getUserByAuthId(args).pipe(Effect.orDie)
);

const usersMutationsImpl = GroupImpl.make(api, "users.mutations")
  .pipe(Layer.provide(users_mutations_updateUserRoleImpl))
  .pipe(Layer.provide(users_mutations_updateUserNameImpl))
  .pipe(Layer.provide(users_mutations_syncUserInfoForChatImpl));

const usersQueriesImpl = GroupImpl.make(api, "users.queries")
  .pipe(Layer.provide(users_queries_getUserByIdImpl))
  .pipe(Layer.provide(users_queries_getUserByAuthIdImpl));

const usersImpl = GroupImpl.make(api, "users")
  .pipe(Layer.provide(usersMutationsImpl))
  .pipe(Layer.provide(usersQueriesImpl));

export const usersLayer = Layer.mergeAll(usersImpl);
