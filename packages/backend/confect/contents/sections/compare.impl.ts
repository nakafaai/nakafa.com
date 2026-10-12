import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { rankQuestions } from "@repo/backend/confect/contents/sections/compare";
import spec, {
  type compareResultValidator,
} from "@repo/backend/confect/contents/sections/compare.spec";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { Effect, Layer } from "effect";

type Failed = Extract<typeof compareResultValidator.Type, { kind: "failed" }>;

/** Answers with the failure that ended the run, which the model test reports as the reason of that run. */
const failed = (failure: Failed["failure"]) =>
  Effect.succeed<Failed>({ failure, kind: "failed" });

const rank = FunctionImpl.make(
  databaseSchema,
  spec,
  "rank",
  Effect.fn("contents.sections.compare.rank")(function* (args) {
    return yield* rankQuestions(args).pipe(
      Effect.provide(GatewayLive),
      Effect.catchTags({
        GatewayConfigurationError: failed,
        GatewayFailure: failed,
      })
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(rank),
  GroupImpl.finalize
);
