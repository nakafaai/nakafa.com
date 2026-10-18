import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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

/** Implements the acceptance seed of `seed.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sitting),
  GroupImpl.finalize
);
