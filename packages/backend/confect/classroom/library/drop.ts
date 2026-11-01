import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { MAX_PASSAGES } from "@repo/backend/confect/classroom/passages";
import { Effect } from "effect";

/** Deletes the passages of one file. */
export const dropPassages = Effect.fn("classroom.passages.drop")(function* (
  itemId: GenericId.GenericId<"classroomLibrary">
) {
  const rows = yield* (yield* DatabaseReader)
    .table("classroomPassages")
    .index("by_itemId", (query) => query.eq("itemId", itemId))
    .take(MAX_PASSAGES)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Effect.forEach(
    rows,
    (row) => writer.table("classroomPassages").delete(row._id),
    { discard: true }
  ).pipe(Effect.orDie);
});
