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
import {
  Array as Arr,
  Effect,
  Layer,
  Option,
  Predicate,
  Record,
  Result,
} from "effect";

/** Rows one call scans in each table: far below the transaction write limit. */
const PAGE_SIZE = 100;

/**
 * Where the next call starts, given the creation times a call scanned: after
 * the last one of a full page, and nowhere after a short page.
 */
function nextAfter(scanned: readonly number[]) {
  return Arr.last(scanned).pipe(
    Option.filter(() => scanned.length === PAGE_SIZE),
    Option.getOrNull
  );
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
const sealChats = Effect.fn("nina.seal.chats")(function* (
  after: number | null
) {
  if (after === null) {
    return { next: null, sealed: 0 };
  }
  const writer = yield* DatabaseWriter;
  const chats = yield* (yield* DatabaseReader)
    .table("chats")
    .index("by_creation_time", (q) => q.gt("_creationTime", after))
    .take(PAGE_SIZE)
    .pipe(Effect.orDie);
  const sealed = yield* sealRows(
    Arr.filterMap(chats, (chat) =>
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
  return {
    next: nextAfter(Arr.map(chats, (chat) => chat._creationTime)),
    sealed,
  };
});

/** Seals one page of summaries whose text is still a string. */
const sealSummaries = Effect.fn("nina.seal.summaries")(function* (
  after: number | null
) {
  if (after === null) {
    return { next: null, sealed: 0 };
  }
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const summaries = yield* reader
    .table("ninaSummaries")
    .index("by_creation_time", (q) => q.gt("_creationTime", after))
    .take(PAGE_SIZE)
    .pipe(Effect.orDie);
  // A summary belongs to the learner who owns its chat. One whose chat is gone
  // stays as it is, because the chat cleanup deletes it.
  const owned = yield* Effect.forEach(
    Arr.filterMap(summaries, (summary) =>
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
            Option.some({ ...summary, userId: chat.userId })
          ),
          Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
          Effect.orDie
        )
  );
  const sealed = yield* sealRows(
    Arr.getSomes(owned),
    SUMMARY_TEXT,
    (summary, text) =>
      writer
        .table("ninaSummaries")
        .patch(summary.id, { text })
        .pipe(Effect.orDie)
  );
  return {
    next: nextAfter(Arr.map(summaries, (summary) => summary._creationTime)),
    sealed,
  };
});

const sealPlain = FunctionImpl.make(
  schema,
  spec,
  "sealPlain",
  Effect.fn("nina.seal.sealPlain")(function* (after) {
    return {
      chats: yield* sealChats(after.chats),
      summaries: yield* sealSummaries(after.summaries),
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(sealPlain),
  GroupImpl.finalize
);
