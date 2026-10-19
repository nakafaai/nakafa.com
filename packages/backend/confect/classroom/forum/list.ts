import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { channelView } from "@repo/backend/confect/classroom/forum/channel";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { Array as Arr, Effect, Struct } from "effect";

/**
 * One page of a class's channels in position order, the general channel first.
 * The read is indexed by class and bounded by the page size. The class's own
 * `forum.read` decision admits it, so an archived class keeps its list.
 */
export const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.forum.channels.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const page = yield* (yield* DatabaseReader)
      .table("classroomChannels")
      .index("by_classId_and_position", (query) => query.eq("classId", row._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, channelView) });
  })
);
