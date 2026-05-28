import { FunctionImpl, GroupImpl } from "@confect/server";
import nodeApi from "@repo/backend/confect/_generated/nodeApi";
import { getLatestJwks } from "@repo/backend/confect/modules/identity/auth/runtime.service";
import { Effect, Layer } from "effect";

const auth_getLatestJwksImpl = FunctionImpl.make(
  nodeApi,
  "auth",
  "getLatestJwks",
  (_args) => getLatestJwks().pipe(Effect.orDie)
);

const authImpl = GroupImpl.make(nodeApi, "auth").pipe(
  Layer.provide(auth_getLatestJwksImpl)
);

export const authNodeLayer = Layer.mergeAll(authImpl);
