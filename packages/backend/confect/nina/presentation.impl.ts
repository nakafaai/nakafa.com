import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec, {
  DEFAULT_TITLE,
} from "@repo/backend/confect/nina/presentation.spec";
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
    if (args.title && (!chat.title || chat.title === DEFAULT_TITLE)) {
      yield* writer
        .table("chats")
        .patch(chat._id, { title: args.title })
        .pipe(Effect.orDie);
    }
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(save),
  GroupImpl.finalize
);
