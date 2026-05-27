import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as identity_users from "@repo/backend/confect/modules/identity/users.service";
import { Effect, Layer } from "effect";

const users_mutations_updateUserRoleImpl = FunctionImpl.make(
  api,
  "users.mutations",
  "updateUserRole",
  (args) =>
    identity_users
      .updateUserRole(args)
      .pipe(Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)))
);

const users_mutations_updateUserNameImpl = FunctionImpl.make(
  api,
  "users.mutations",
  "updateUserName",
  (args) =>
    identity_users
      .updateUserName(args)
      .pipe(Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)))
);

const users_mutations_syncUserInfoForChatImpl = FunctionImpl.make(
  api,
  "users.mutations",
  "syncUserInfoForChat",
  (_args) =>
    identity_users
      .syncUserInfoForChat()
      .pipe(Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)))
);

const users_queries_getUserByIdImpl = FunctionImpl.make(
  api,
  "users.queries",
  "getUserById",
  (args) => identity_users.getUserById(args)
);

const users_queries_getUserByAuthIdImpl = FunctionImpl.make(
  api,
  "users.queries",
  "getUserByAuthId",
  (args) => identity_users.getUserByAuthId(args)
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
