import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { seedLoad } from "@repo/backend/confect/exams/seed/load";
import { seedSeats } from "@repo/backend/confect/exams/seed/seats";
import { seedSitting } from "@repo/backend/confect/exams/seed/sitting";
import spec from "@repo/backend/confect/exams/seed.spec";
import { Effect, Layer } from "effect";

const sitting = FunctionImpl.make(
  databaseSchema,
  spec,
  "sitting",
  Effect.fn("exams.seed.sitting.function")(function* (args) {
    return yield* seedSitting(args);
  })
);

const load = FunctionImpl.make(
  databaseSchema,
  spec,
  "load",
  Effect.fn("exams.seed.load.function")(function* (args) {
    return yield* seedLoad(args);
  })
);

const seats = FunctionImpl.make(
  databaseSchema,
  spec,
  "seats",
  Effect.fn("exams.seed.seats.function")(function* (args) {
    return yield* seedSeats(args);
  })
);

/** Implements the acceptance seed of `seed.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sitting),
  Layer.provide(load),
  Layer.provide(seats),
  GroupImpl.finalize
);
