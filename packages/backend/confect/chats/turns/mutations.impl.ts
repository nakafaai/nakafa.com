import { FunctionImpl, GroupImpl } from "@confect/server";
import { ModelIdSchema } from "@repo/ai/config/model";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  readChatTurn,
  refundChatTurn,
  reserveChatTurn,
} from "@repo/backend/confect/chats/turns/impl";
import spec from "@repo/backend/confect/chats/turns/mutations.spec";
import { Effect, Layer } from "effect";

/** Admits one authenticated turn before the HTTP adapter starts provider work. */
const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("chats.turns.mutations.reserve")(function* (args) {
    const ctx = yield* MutationCtxService;
    const { appUser } = yield* requireAuth(ctx);
    return yield* reserveChatTurn(
      ctx,
      appUser,
      ModelIdSchema.make(args.modelId)
    );
  })
);
const release = FunctionImpl.make(
  databaseSchema,
  spec,
  "release",
  Effect.fn("chats.turns.mutations.release")(function* (args) {
    const ctx = yield* MutationCtxService;
    const { appUser } = yield* requireAuth(ctx);
    return yield* Effect.gen(function* () {
      const turn = yield* readChatTurn(
        ctx,
        args.turnId,
        appUser._id,
        undefined
      );
      if (turn) {
        yield* refundChatTurn(ctx, turn);
      }
      return null;
    });
  })
);
const expire = FunctionImpl.make(
  databaseSchema,
  spec,
  "expire",
  Effect.fn("chats.turns.mutations.expire")(function* (args) {
    const ctx = yield* MutationCtxService;
    const reader = yield* DatabaseReader;
    const turn = yield* reader
      .table("chatTurns")
      .get(args.turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (turn) {
      yield* refundChatTurn(ctx, turn);
    }
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reserve),
  Layer.provide(release),
  Layer.provide(expire),
  GroupImpl.finalize
);
