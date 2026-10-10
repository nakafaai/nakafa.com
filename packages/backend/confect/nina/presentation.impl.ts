import { FunctionImpl, GroupImpl } from "@confect/server";
import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { openChat, sealTitle } from "@repo/backend/confect/chats/title";
import spec from "@repo/backend/confect/nina/presentation.spec";
import { Effect, Layer } from "effect";

const save = FunctionImpl.make(
  schema,
  spec,
  "save",
  Effect.fn("nina.presentation.save")(function* (args) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const turn = yield* reader
      .table("ninaTurns")
      .get(args.turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !turn ||
      turn.state.status === "failed" ||
      turn.state.status === "cancelled"
    ) {
      return null;
    }
    const chat = yield* reader
      .table("chats")
      .get(turn.chatId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!chat) {
      return null;
    }
    if (args.suggestions) {
      yield* writer
        .table("ninaTurns")
        .patch(turn._id, { suggestions: args.suggestions })
        .pipe(Effect.orDie);
    }
    if (!args.title) {
      return null;
    }
    // Only a chat that still has the default title takes the generated one.
    const current = (yield* openChat(chat)).title;
    if (!current || current === DEFAULT_TITLE) {
      yield* writer
        .table("chats")
        .patch(chat._id, { title: yield* sealTitle(chat.userId, args.title) })
        .pipe(Effect.orDie);
    }
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(save),
  GroupImpl.finalize
);
