import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { erasePostHogPerson } from "@repo/backend/confect/analytics/erasure/action";
import spec from "@repo/backend/confect/analytics/erasure/action.spec";
import { Effect, Layer } from "effect";

const eraseUserAnalytics = FunctionImpl.make(
  databaseSchema,
  spec,
  "eraseUserAnalytics",
  Effect.fn("analytics.erasure.action.eraseUserAnalytics")(function* (args) {
    yield* erasePostHogPerson(args.userId);
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(eraseUserAnalytics),
  GroupImpl.finalize
);
