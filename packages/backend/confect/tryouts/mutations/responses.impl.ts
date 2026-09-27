import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/tryouts/mutations/responses.spec";
import { saveTryoutResponse } from "@repo/backend/confect/tryouts/response/write";
import { Clock, Effect, Layer } from "effect";

/** Saves one placement choice with server-owned timing and integrity checks. */
const save = FunctionImpl.make(
  databaseSchema,
  spec,
  "save",
  Effect.fn("tryouts.mutations.responses.save")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth(ctx);
      const now = yield* Clock.currentTimeMillis;
      return yield* saveTryoutResponse(ctx, {
        args,
        now,
        userId: appUser._id,
      });
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(save),
  GroupImpl.finalize
);
