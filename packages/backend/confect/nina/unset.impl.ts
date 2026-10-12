import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { RetiredModelKey } from "@repo/backend/confect/nina/contract/turn";
import spec, { type UnsetPage } from "@repo/backend/confect/nina/unset.spec";
import type { PaginationResult } from "convex/server";
import {
  Array as Arr,
  Effect,
  Layer,
  Match,
  Record,
  Result,
  Schema,
} from "effect";

/** The name under which the credit ledger noted the model key of a turn. */
const LEDGER_NOTE = "modelId";

/** What one call reports, whichever table it read. */
function report(read: PaginationResult<unknown>, changed: number) {
  return {
    changed,
    continueCursor: read.continueCursor,
    isDone: read.isDone,
    scanned: read.page.length,
  };
}

/**
 * Replaces each turn of one page that holds the key with the same turn
 * without it, in whichever phase the turn is. The page already holds the whole
 * turn, so `replace` writes it back without the second read that `patch` makes.
 */
const unsetTurns = Effect.fn("nina.unset.turns")(function* (
  page: typeof UnsetPage.Type
) {
  const read = yield* (yield* DatabaseReader)
    .table("ninaTurns")
    .index("by_creation_time")
    .paginate(page)
    .pipe(Effect.orDie);
  const held = Arr.filterMap(
    read.page,
    ({ _id, _creationTime, modelId, ...turn }) =>
      modelId === undefined
        ? Result.failVoid
        : Result.succeed({ id: _id, turn })
  );
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    held,
    ({ id, turn }) =>
      writer.table("ninaTurns").replace(id, turn).pipe(Effect.orDie),
    { discard: true }
  );
  return report(read, held.length);
});

/**
 * Replaces each credit transaction of one page whose metadata notes a retired
 * key with the same transaction without that note, for the same reason. A note
 * with another name or another value is not the key, and stays.
 */
const unsetTransactions = Effect.fn("nina.unset.transactions")(function* (
  page: typeof UnsetPage.Type
) {
  const read = yield* (yield* DatabaseReader)
    .table("creditTransactions")
    .index("by_creation_time")
    .paginate(page)
    .pipe(Effect.orDie);
  const held = Arr.filterMap(
    read.page,
    ({ _id, _creationTime, metadata, ...transaction }) =>
      metadata !== undefined &&
      Schema.is(RetiredModelKey)(metadata[LEDGER_NOTE])
        ? Result.succeed({
            id: _id,
            transaction: {
              ...transaction,
              metadata: Record.remove(metadata, LEDGER_NOTE),
            },
          })
        : Result.failVoid
  );
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    held,
    ({ id, transaction }) =>
      writer
        .table("creditTransactions")
        .replace(id, transaction)
        .pipe(Effect.orDie),
    { discard: true }
  );
  return report(read, held.length);
});

const unsetModelKey = FunctionImpl.make(
  schema,
  spec,
  "modelKey",
  Effect.fn("nina.unset.modelKey")(function* ({ table, ...page }) {
    return yield* Match.value(table).pipe(
      Match.when("ninaTurns", () => unsetTurns(page)),
      Match.when("creditTransactions", () => unsetTransactions(page)),
      Match.exhaustive
    );
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(unsetModelKey),
  GroupImpl.finalize
);
