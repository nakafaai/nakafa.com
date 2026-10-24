import {
  type MutationServices,
  mutationLayer,
} from "@confect/server/RegisteredConvexFunction";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** A convex-test instance over the app schema and every Convex module. */
export function createBillingTestConvex() {
  return convexTest(schema, convexModules);
}

/** Runs one Confect effect inside a test mutation, so its database services read and write the same transaction. */
export function runInMutation<A, E>(
  ctx: MutationCtx,
  effect: Effect.Effect<A, E, MutationServices<typeof databaseSchema>>
) {
  return Effect.runPromise(
    effect.pipe(Effect.provide(mutationLayer(databaseSchema, ctx)))
  );
}
