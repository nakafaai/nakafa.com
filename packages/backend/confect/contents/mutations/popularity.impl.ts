import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import {
  expireLearningPopularityWindowPage as expireLearningPopularityWindowPageProgram,
  scheduleLearningPopularityExpiries as scheduleLearningPopularityExpiriesProgram,
} from "@repo/backend/confect/contents/metrics/expiry";
import {
  refreshLearningPopularityWindowPage as refreshLearningPopularityWindowPageProgram,
  scheduleLearningPopularityRefreshes as scheduleLearningPopularityRefreshesProgram,
} from "@repo/backend/confect/contents/metrics/refresh";
import { pruneLearningPopularity as pruneLearningPopularityProgram } from "@repo/backend/confect/contents/metrics/retention";
import spec from "@repo/backend/confect/contents/mutations/popularity.spec";
import { Effect, Layer } from "effect";

const pruneLearningPopularity = FunctionImpl.make(
  databaseSchema,
  spec,
  "pruneLearningPopularity",
  Effect.fn("contents.mutations.popularity.pruneLearningPopularity")(
    function* () {
      const ctx = yield* MutationCtxService;
      return yield* pruneLearningPopularityProgram(ctx);
    }
  )
);
const scheduleLearningPopularityExpiries = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleLearningPopularityExpiries",
  Effect.fn("contents.mutations.popularity.scheduleLearningPopularityExpiries")(
    function* () {
      const ctx = yield* MutationCtxService;
      return yield* scheduleLearningPopularityExpiriesProgram(ctx);
    }
  )
);
const scheduleLearningPopularityRefreshes = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleLearningPopularityRefreshes",
  Effect.fn(
    "contents.mutations.popularity.scheduleLearningPopularityRefreshes"
  )(function* () {
    const ctx = yield* MutationCtxService;
    return yield* scheduleLearningPopularityRefreshesProgram(ctx);
  })
);
const refreshLearningPopularityWindowPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "refreshLearningPopularityWindowPage",
  Effect.fn(
    "contents.mutations.popularity.refreshLearningPopularityWindowPage"
  )(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* refreshLearningPopularityWindowPageProgram(ctx, args);
  })
);
const expireLearningPopularityWindowPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "expireLearningPopularityWindowPage",
  Effect.fn("contents.mutations.popularity.expireLearningPopularityWindowPage")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      return yield* expireLearningPopularityWindowPageProgram(ctx, args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(pruneLearningPopularity),
  Layer.provide(scheduleLearningPopularityExpiries),
  Layer.provide(scheduleLearningPopularityRefreshes),
  Layer.provide(refreshLearningPopularityWindowPage),
  Layer.provide(expireLearningPopularityWindowPage),
  GroupImpl.finalize
);
