import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { rankQuestions } from "@repo/backend/confect/contents/sections/compare";
import spec from "@repo/backend/confect/contents/sections/compare.spec";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { Effect, Layer } from "effect";

const rank = FunctionImpl.make(
  databaseSchema,
  spec,
  "rank",
  Effect.fn("contents.sections.compare.rank")(function* (args) {
    return yield* rankQuestions(args).pipe(Effect.provide(GatewayLive));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(rank),
  GroupImpl.finalize
);
