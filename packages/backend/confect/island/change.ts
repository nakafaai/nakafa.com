import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { chunkKeyOf, regionOf } from "@repo/backend/confect/island/chunk";
import spec from "@repo/backend/confect/island/mutations.spec";
import { settle } from "@repo/backend/confect/island/operation";
import { ensureIsland } from "@repo/backend/confect/island/store";
import { Array as Arr, Effect, HashMap, Option, Struct } from "effect";

/**
 * Writes a batch of the learner's changes to their world (ADR 0050, W4). The
 * island is read once and each chunk the batch names once; `settle` applies
 * the operations in order, and each chunk that came out different is written
 * once: made on its first change, replaced, or deleted when nothing of it is
 * left. Nothing is refused for being made against an older copy. Answers one
 * outcome for each operation, in order.
 */
export const change = FunctionImpl.make(
  databaseSchema,
  spec,
  "change",
  Effect.fn("island.mutations.change")(function* ({ ops }) {
    const { appUser } = yield* requireAuth();
    const island = yield* ensureIsland(appUser._id);
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const userId = island.userId;
    const touched = Arr.dedupeWith(
      ops,
      (one, other) => one.cx === other.cx && one.cz === other.cz
    );
    const found = yield* Effect.forEach(touched, ({ cx, cz }) =>
      database
        .table("islandChunks")
        .index("by_userId_and_cx_and_cz", (query) =>
          query.eq("userId", userId).eq("cx", cx).eq("cz", cz)
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(Option.map((row) => [chunkKeyOf(cx, cz), row] as const))
        )
    );
    const rows = HashMap.fromIterable(Arr.getSomes(found));
    const stored = HashMap.map(
      rows,
      Struct.pick(["clears", "lifts", "paints", "things"])
    );
    const count = island.chunks ?? 0;
    const settled = settle(stored, count, island.blueprints ?? [], ops);
    for (const { cx, cz } of touched) {
      const key = chunkKeyOf(cx, cz);
      const row = HashMap.get(rows, key);
      const before = Option.getOrUndefined(HashMap.get(stored, key));
      const after = HashMap.get(settled.chunks, key);
      if (Option.isSome(row) && Option.isNone(after)) {
        yield* writer
          .table("islandChunks")
          .delete(row.value._id)
          .pipe(Effect.orDie);
      }
      if (
        Option.isSome(row) &&
        Option.isSome(after) &&
        before !== after.value
      ) {
        yield* writer
          .table("islandChunks")
          .patch(row.value._id, after.value)
          .pipe(Effect.orDie);
      }
      if (Option.isNone(row) && Option.isSome(after)) {
        const place = { cx, cz, rx: regionOf(cx), rz: regionOf(cz), userId };
        yield* writer
          .table("islandChunks")
          .insert({ ...after.value, ...place })
          .pipe(Effect.orDie);
      }
    }
    if (settled.count !== count) {
      yield* writer
        .table("islands")
        .patch(island._id, { chunks: settled.count })
        .pipe(Effect.orDie);
    }
    return settled.outcomes;
  })
);
