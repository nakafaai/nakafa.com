import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/unanswered.spec";
import { Clock, Effect, Layer } from "effect";

const settle = FunctionImpl.make(
  schema,
  spec,
  "settle",
  Effect.fn("nina.unanswered.settle")(function* ({ numItems }) {
    const turns = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index("by_phase", (q) => q.eq("phase", "unanswered"))
      .take(numItems)
      .pipe(Effect.orDie);
    const finishedAt = yield* Clock.currentTimeMillis;
    const writer = yield* DatabaseWriter;
    // The page already holds the whole turn, so `replace` writes it back
    // without the second read that `patch` makes.
    yield* Effect.forEach(
      turns,
      ({ _id, _creationTime, ...turn }) =>
        writer
          .table("ninaTurns")
          .replace(_id, {
            ...turn,
            phase: "settled",
            state: { finishedAt, reason: "interrupted", status: "failed" },
          })
          .pipe(Effect.orDie),
      { discard: true }
    );
    return { settled: turns.length };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(settle),
  GroupImpl.finalize
);
