import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/exams/joins.spec";
import { joinRoom } from "@repo/backend/confect/exams/sittings/join";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const join = FunctionImpl.make(
  databaseSchema,
  spec,
  "join",
  Effect.fn("exams.joins.join")(function* (args) {
    return yield* joinRoom(args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(join),
  Layer.provide(session),
  GroupImpl.finalize
);
