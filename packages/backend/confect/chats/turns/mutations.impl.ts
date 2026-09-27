import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  readChatTurn,
  refundChatTurn,
  reserveChatTurn,
} from "@repo/backend/confect/chats/turns/impl";
import spec from "@repo/backend/confect/chats/turns/mutations.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { ModelIdSchema } from "@repo/backend/confect/nina/config/model";
import { Effect, Layer } from "effect";

/** Admits one authenticated turn before the HTTP adapter starts provider work. */
const reserve = FunctionImpl.make(
  databaseSchema,
  spec,
  "reserve",
  Effect.fn("chats.turns.mutations.reserve")(function* (args) {
    const { appUser } = yield* requireAuth();
    return yield* reserveChatTurn(appUser, ModelIdSchema.make(args.modelId));
  })
);
const release = FunctionImpl.make(
  databaseSchema,
  spec,
  "release",
  Effect.fn("chats.turns.mutations.release")(function* (args) {
    const { appUser } = yield* requireAuth();
    return yield* Effect.gen(function* () {
      const turn = yield* readChatTurn(args.turnId, appUser._id, undefined);
      if (turn) {
        yield* refundChatTurn(turn);
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
    const reader = yield* DatabaseReader;
    const turn = yield* reader
      .table("chatTurns")
      .get(args.turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (turn) {
      yield* refundChatTurn(turn);
    }
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(reserve),
  Layer.provide(release),
  Layer.provide(expire),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
