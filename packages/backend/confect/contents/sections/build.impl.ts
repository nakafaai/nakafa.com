import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { runStep } from "@repo/backend/confect/contents/sections/build";
import spec from "@repo/backend/confect/contents/sections/build.spec";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { Effect, Layer } from "effect";

const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("contents.sections.build.run")(function* (args) {
    // A build step that fails is a defect: the scheduled run fails visibly,
    // and its logged position resumes it.
    return yield* runStep(args).pipe(Effect.provide(GatewayLive), Effect.orDie);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
