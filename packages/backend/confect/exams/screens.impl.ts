import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/exams/screens.spec";
import { sittingAccess } from "@repo/backend/confect/exams/sittings/authority";
import {
  beat,
  offlineSeats,
  roomSeats,
} from "@repo/backend/confect/exams/sittings/presence";
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

/** Keeps a student's attempt present in its room. */
const beatFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "beat",
  Effect.fn("exams.screens.beat.function")(function* (args) {
    return yield* beat(args);
  })
);

/** The students of a room who went silent, for a proctor who may view the sitting. */
const offlineFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "offline",
  Effect.fn("exams.screens.offline.function")(function* () {
    return yield* offlineSeats();
  })
);

/** How one room's seats stand, for the exam's rooms. */
const seatsFunction = FunctionImpl.make(
  databaseSchema,
  spec,
  "seats",
  Effect.fn("exams.screens.seats.function")(function* () {
    return yield* roomSeats();
  })
);

/** Implements the screens group of `screens.spec.ts`: a student's look and beat, and what a proctor reads of them. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(lookFunction),
  Layer.provide(screenFunction),
  Layer.provide(beatFunction),
  Layer.provide(offlineFunction),
  Layer.provide(seatsFunction),
  Layer.provide(Layer.mergeAll(session, member, sittingAccess)),
  GroupImpl.finalize
);
