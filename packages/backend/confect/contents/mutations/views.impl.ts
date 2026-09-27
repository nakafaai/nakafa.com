import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contents/mutations/views.spec";
import { recordUniqueContentView } from "@repo/backend/confect/contents/views/impl";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { internal } from "@repo/backend/convex/_generated/api";
import { Effect, Layer } from "effect";

const recordContentView = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordContentView",
  Effect.fn("contents.mutations.views.recordContentView")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* recordUniqueContentView(
      ctx,
      args,
      internal.contents.mutations.analytics.scheduleContentAnalyticsPartition
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(recordContentView),
  Layer.provide(atomic),
  GroupImpl.finalize
);
