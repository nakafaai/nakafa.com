import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { getTryoutStartAccess } from "@repo/backend/confect/tryouts/access/impl";
import { anonymousStartAccess } from "@repo/backend/confect/tryouts/queries/access";
import spec from "@repo/backend/confect/tryouts/queries/access.spec";
import { Effect, Layer } from "effect";

const getStartAccess = FunctionImpl.make(
  databaseSchema,
  spec,
  "getStartAccess",
  Effect.fn("tryouts.queries.access.getStartAccess")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* Effect.gen(function* () {
      const auth = yield* getOptionalAppUserForRead(ctx);
      if (!auth) {
        return anonymousStartAccess;
      }
      return yield* getTryoutStartAccess(ctx, {
        ...args,
        userId: auth.appUser._id,
      });
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getStartAccess),
  GroupImpl.finalize
);
