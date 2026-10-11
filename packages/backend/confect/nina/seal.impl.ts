import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { CHAT_TITLE } from "@repo/backend/confect/chats/title";
import spec from "@repo/backend/confect/nina/seal.spec";
import { SUMMARY_TEXT } from "@repo/backend/confect/nina/summaries/text";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import type { VaultField } from "@repo/backend/confect/vault/schema";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Layer, Predicate, Record, Result } from "effect";

/** Rows one call reads in its table: far below the transaction write limit. */
const PAGE_SIZE = 100;

/** Where the next call starts: the cursor of the page, none after the last one. */
function nextCursor(page: {
  readonly continueCursor: string;
  readonly isDone: boolean;
}) {
  return page.isDone ? null : page.continueCursor;
}

/**
 * Seals the plain text of rows and stores it. Rows are grouped by learner, so
 * each learner's key is read once for all of their rows. It returns how many
 * rows it sealed.
 */
const sealRows = Effect.fn("nina.seal.rows")(function* <
  Row extends { readonly text: string; readonly userId: Docs["users"]["_id"] },
>(
  rows: readonly Row[],
  field: typeof VaultField.Type,
  store: (row: Row, sealed: ArrayBuffer) => Effect.Effect<void>
) {
  for (const owned of Record.values(Arr.groupBy(rows, (row) => row.userId))) {
    const keys = yield* ensureLearnerKeys(Arr.headNonEmpty(owned).userId).pipe(
      Effect.orDie
    );
    for (const row of owned) {
      yield* store(
        row,
        yield* sealText(keys, field, row.text).pipe(Effect.orDie)
      );
    }
  }
  return rows.length;
});

/** Seals one page of chats whose title is still a string. */
const sealChats = FunctionImpl.make(
  schema,
  spec,
  "sealChats",
  Effect.fn("nina.seal.sealChats")(function* ({ cursor }) {
    const writer = yield* DatabaseWriter;
    const page = yield* (yield* DatabaseReader)
      .table("chats")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PAGE_SIZE })
      .pipe(Effect.orDie);
    const sealed = yield* sealRows(
      Arr.filterMap(page.page, (chat) =>
        Predicate.isString(chat.title)
          ? Result.succeed({
              id: chat._id,
              text: chat.title,
              userId: chat.userId,
            })
          : Result.failVoid
      ),
      CHAT_TITLE,
      (chat, title) =>
        writer.table("chats").patch(chat.id, { title }).pipe(Effect.orDie)
    );
    return { next: nextCursor(page), sealed };
  })
);

/**
 * Seals one page of summaries whose text is still a string. A summary belongs
 * to the learner who owns its chat. One whose chat is gone has no key to seal
 * it with and nothing can read it, so it is deleted, as the chat cleanup would
 * have done.
 */
const sealSummaries = FunctionImpl.make(
  schema,
  spec,
  "sealSummaries",
  Effect.fn("nina.seal.sealSummaries")(function* ({ cursor }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const page = yield* reader
      .table("ninaSummaries")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PAGE_SIZE })
      .pipe(Effect.orDie);
    const [owned, gone] = Arr.separate(
      yield* Effect.forEach(
        Arr.filterMap(page.page, (summary) =>
          Predicate.isString(summary.text)
            ? Result.succeed({
                chatId: summary.chatId,
                id: summary._id,
                text: summary.text,
              })
            : Result.failVoid
        ),
        (summary) =>
          reader
            .table("chats")
            .get(summary.chatId)
            .pipe(
              Effect.map((chat) =>
                Result.succeed({ ...summary, userId: chat.userId })
              ),
              Effect.catchTag("GetByIdFailure", () =>
                Effect.succeed(Result.fail(summary.id))
              ),
              Effect.orDie
            )
      )
    );
    const sealed = yield* sealRows(owned, SUMMARY_TEXT, (summary, text) =>
      writer
        .table("ninaSummaries")
        .patch(summary.id, { text })
        .pipe(Effect.orDie)
    );
    yield* Effect.forEach(
      gone,
      (id) => writer.table("ninaSummaries").delete(id).pipe(Effect.orDie),
      { discard: true }
    );
    return { next: nextCursor(page), removed: gone.length, sealed };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(sealChats),
  Layer.provide(sealSummaries),
  GroupImpl.finalize
);
