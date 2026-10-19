import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/classroom/forum/backfill.spec";
import { insertGeneral } from "@repo/backend/confect/classroom/forum/general";
import { Clock, Effect, Layer, Option } from "effect";

/** How many classes one call reads, in creation order. */
const BACKFILL_PAGE = 100;

/** Whether a class already holds its general channel, which the class creation writes at position 0. */
const hasGeneral = Effect.fnUntraced(function* (
  classId: GenericId.GenericId<"classes">
) {
  const first = yield* (yield* DatabaseReader)
    .table("classroomChannels")
    .index("by_classId_and_position", (query) =>
      query.eq("classId", classId).eq("position", 0)
    )
    .first()
    .pipe(Effect.orDie);
  return Option.exists(first, (channel) => channel.kind === "general");
});

/** Writes the general channel of each class on one page that lacks it, and reports the next page. */
export const general = FunctionImpl.make(
  databaseSchema,
  spec,
  "general",
  Effect.fn("classroom.forum.backfill.general")(function* ({ cursor }) {
    const page = yield* (yield* DatabaseReader)
      .table("classes")
      .index("by_creation_time")
      .paginate({ cursor: cursor ?? null, numItems: BACKFILL_PAGE })
      .pipe(Effect.orDie);
    const missing = yield* Effect.filter(page.page, (row) =>
      Effect.map(hasGeneral(row._id), (present) => !present)
    );
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.forEach(
      missing,
      (row) => insertGeneral(row._id, row.tenantId, now),
      { discard: true }
    );
    return {
      continueCursor: page.continueCursor,
      created: missing.length,
      done: page.isDone,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(general),
  GroupImpl.finalize
);
