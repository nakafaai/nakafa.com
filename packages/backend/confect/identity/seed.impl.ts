import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { seedCard } from "@repo/backend/confect/identity/seed/card";
import spec from "@repo/backend/confect/identity/seed.spec";
import { Effect, Layer } from "effect";

const card = FunctionImpl.make(
  databaseSchema,
  spec,
  "card",
  Effect.fn("identity.seed.card.function")(function* (args) {
    return yield* seedCard(args);
  })
);

/** Implements the acceptance seed of `seed.spec.ts`. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(card),
  GroupImpl.finalize
);
