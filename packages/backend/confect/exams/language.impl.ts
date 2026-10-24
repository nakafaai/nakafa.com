import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/exams/language.spec";
import { Array as Arr, Effect, Layer, Struct } from "effect";

/** How many exams one call reads, in creation order. */
const CLEAR_PAGE = 100;

/**
 * Rewrites each exam of one page that holds a language without it, and reports the next page. The
 * rewrite replaces the whole exam, so the field is absent from the row afterwards.
 */
export const clear = FunctionImpl.make(
  databaseSchema,
  spec,
  "clear",
  Effect.fn("exams.language.clear")(function* ({ cursor }) {
    const page = yield* (yield* DatabaseReader)
      .table("exams")
      .index("by_creation_time")
      .paginate({ cursor: cursor ?? null, numItems: CLEAR_PAGE })
      .pipe(Effect.orDie);
    const holding = Arr.filter(page.page, (row) => row.language !== undefined);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      holding,
      (row) =>
        writer
          .table("exams")
          .replace(
            row._id,
            Struct.omit(row, ["_creationTime", "_id", "language"])
          )
          .pipe(Effect.orDie),
      { discard: true }
    );
    return {
      cleared: holding.length,
      continueCursor: page.continueCursor,
      done: page.isDone,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(clear),
  GroupImpl.finalize
);
