import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { processClaimedContentAnalyticsPartition } from "@repo/backend/confect/contents/analytics/drain";
import {
  claimContentAnalyticsPartition,
  scheduleAllContentAnalyticsPartitions,
} from "@repo/backend/confect/contents/analytics/impl";
import spec from "@repo/backend/confect/contents/mutations/analytics.spec";
import { Effect, Layer } from "effect";

const scheduleContentAnalyticsPartitions = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleContentAnalyticsPartitions",
  Effect.fn("contents.mutations.analytics.scheduleContentAnalyticsPartitions")(
    function* () {
      const ctx = yield* MutationCtxService;
      return yield* scheduleAllContentAnalyticsPartitions(ctx);
    }
  )
);
const scheduleContentAnalyticsPartition = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleContentAnalyticsPartition",
  Effect.fn("contents.mutations.analytics.scheduleContentAnalyticsPartition")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      return yield* claimContentAnalyticsPartition(ctx, args);
    }
  )
);
const processContentAnalyticsPartition = FunctionImpl.make(
  databaseSchema,
  spec,
  "processContentAnalyticsPartition",
  Effect.fn("contents.mutations.analytics.processContentAnalyticsPartition")(
    function* (args) {
      const ctx = yield* MutationCtxService;
      return yield* processClaimedContentAnalyticsPartition(ctx, args);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(scheduleContentAnalyticsPartitions),
  Layer.provide(scheduleContentAnalyticsPartition),
  Layer.provide(processContentAnalyticsPartition),
  GroupImpl.finalize
);
