import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
      return yield* pruneLearningPopularityProgram();
    }
  )
);
const scheduleLearningPopularityExpiries = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleLearningPopularityExpiries",
  Effect.fn("contents.mutations.popularity.scheduleLearningPopularityExpiries")(
    function* () {
      return yield* scheduleLearningPopularityExpiriesProgram();
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
    return yield* scheduleLearningPopularityRefreshesProgram();
  })
);
const refreshLearningPopularityWindowPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "refreshLearningPopularityWindowPage",
  Effect.fn(
    "contents.mutations.popularity.refreshLearningPopularityWindowPage"
  )(function* (args) {
    return yield* refreshLearningPopularityWindowPageProgram(args);
  })
);
const expireLearningPopularityWindowPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "expireLearningPopularityWindowPage",
  Effect.fn("contents.mutations.popularity.expireLearningPopularityWindowPage")(
    function* (args) {
      return yield* expireLearningPopularityWindowPageProgram(args);
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
