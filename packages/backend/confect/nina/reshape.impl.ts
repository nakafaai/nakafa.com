import { type Document, FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { dropLegacyPage } from "@repo/backend/confect/nina/contract/turn";
import spec, { PAGE_SIZE } from "@repo/backend/confect/nina/reshape.spec";
import { Array as Arr, Effect, Equal, Layer } from "effect";

/**
 * The turn as a turn is written now: without the fields that the oldest turns
 * hold beside their page, and with its page in the new shape.
 */
const dropLegacyTurn = Effect.fn("nina.reshape.drop")(function* ({
  snapshot,
  transition,
  ...turn
}: Document.WithoutSystemFields<Docs["ninaTurns"]>) {
  return turn.page === undefined
    ? turn
    : { ...turn, page: yield* dropLegacyPage(turn.page) };
});

const rewrite = FunctionImpl.make(
  schema,
  spec,
  "rewrite",
  Effect.fn("nina.reshape.rewrite")(function* ({ cursor, dry }) {
    const turns = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index("by_creation_time")
      .paginate({ cursor, numItems: PAGE_SIZE })
      .pipe(Effect.orDie);
    const read = yield* Effect.forEach(
      turns.page,
      ({ _creationTime, _id, ...turn }) =>
        Effect.map(dropLegacyTurn(turn), (current) => ({
          _id,
          current,
          turn,
        }))
    );
    // A turn is in the old shape when dropping what only old turns hold changes it.
    const old = Arr.filter(
      read,
      ({ current, turn }) => !Equal.equals(turn, current)
    );
    if (!dry) {
      const writer = yield* DatabaseWriter;
      // The page already holds the whole turn, so `replace` writes it back
      // without the second read that `patch` makes.
      yield* Effect.forEach(
        old,
        ({ _id, current }) =>
          writer.table("ninaTurns").replace(_id, current).pipe(Effect.orDie),
        { discard: true }
      );
    }
    return {
      next: turns.isDone ? null : turns.continueCursor,
      old: old.length,
      rewritten: dry ? 0 : old.length,
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(rewrite),
  GroupImpl.finalize
);
