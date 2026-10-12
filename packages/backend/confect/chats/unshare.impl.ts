import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { findShare } from "@repo/backend/confect/chats/share";
import spec from "@repo/backend/confect/chats/unshare.spec";
import { Array as Arr, Effect, Layer } from "effect";

/** Chats one call reads: far below the transaction read and write limits. */
const PAGE_SIZE = 100;

const closeLegacy = FunctionImpl.make(
  schema,
  spec,
  "closeLegacy",
  Effect.fn("chats.unshare.closeLegacy")(function* ({ cursor, dry }) {
    const writer = yield* DatabaseWriter;
    const page = yield* (yield* DatabaseReader)
      .table("chats")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PAGE_SIZE })
      .pipe(Effect.orDie);
    const shared = Arr.filter(
      page.page,
      (chat) => chat.visibility === "public"
    );
    const legacy = yield* Effect.filter(shared, (chat) =>
      Effect.map(findShare(chat._id), (share) => share === null)
    );
    if (!dry) {
      yield* Effect.forEach(
        legacy,
        (chat) =>
          writer
            .table("chats")
            .patch(chat._id, { visibility: "private" })
            .pipe(Effect.orDie),
        { discard: true }
      );
    }
    return {
      closed: dry ? 0 : legacy.length,
      legacy: legacy.length,
      next: page.isDone ? null : page.continueCursor,
      shared: shared.length - legacy.length,
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(closeLegacy),
  GroupImpl.finalize
);
