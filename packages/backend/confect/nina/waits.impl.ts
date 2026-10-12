import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { summarizeWaits } from "@repo/backend/confect/nina/waits";
import spec from "@repo/backend/confect/nina/waits.spec";
import { Effect, Layer } from "effect";

/**
 * Reads the newest turns in one indexed read of the built-in creation order, no
 * more than `count`, and summarizes the waits they stored.
 */
const summary = FunctionImpl.make(
  schema,
  spec,
  "summary",
  Effect.fn("nina.waits.summary")(function* ({ count }) {
    const turns = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index("by_creation_time", "desc")
      .take(count)
      .pipe(Effect.orDie);
    return summarizeWaits(turns);
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(summary),
  GroupImpl.finalize
);
