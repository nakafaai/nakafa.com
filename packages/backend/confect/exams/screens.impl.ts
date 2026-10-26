import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/exams/screens.spec";
import { sittingAccess } from "@repo/backend/confect/exams/sittings/authority";
import { look, screen } from "@repo/backend/confect/exams/sittings/screen";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

/** Records the question a student's screen shows now. */
const lookFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "look",
  Effect.fn("exams.screens.look.function")(function* (args) {
    return yield* look(args);
  })
);

/** One student's screen, for a proctor who may view the sitting. */
const screenFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "screen",
  Effect.fn("exams.screens.screen.function")(function* (args) {
    return yield* screen(args);
  })
);

/** Implements the screens group of `screens.spec.ts`: a student's look and a proctor's view of it. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(lookFunction),
  Layer.provide(screenFunction),
  Layer.provide(Layer.mergeAll(session, member, sittingAccess)),
  GroupImpl.finalize
);
