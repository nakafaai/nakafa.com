import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/phase.spec";
import { Effect, Layer } from "effect";

/** True once a run has no reason to go on: its turn was stopped, settled or removed. */
const halted = FunctionImpl.make(
  schema,
  spec,
  "halted",
  Effect.fn("nina.phase.halted")(function* (args) {
    const turn = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .get(args.turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return turn?.phase !== "active" || turn.cancelRequestedAt !== undefined;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(halted),
  GroupImpl.finalize
);
