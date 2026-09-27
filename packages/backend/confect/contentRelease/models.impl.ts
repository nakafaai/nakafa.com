import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationCtx as MutationCtxService,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  readModelStatus,
  restartModelBuild,
  resumeModelBuild,
} from "@repo/backend/confect/contentRelease/models";
import spec from "@repo/backend/confect/contentRelease/models.spec";
import { Effect, Layer } from "effect";

const restart = FunctionImpl.make(
  databaseSchema,
  spec,
  "restart",
  Effect.fn("contentRelease.models.restart")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* restartModelBuild(ctx, args);
  })
);
const status = FunctionImpl.make(
  databaseSchema,
  spec,
  "status",
  Effect.fn("contentRelease.models.status")(function* ({ releaseId }) {
    const ctx = yield* QueryCtxService;
    return yield* readModelStatus(ctx, releaseId);
  })
);
const resume = FunctionImpl.make(
  databaseSchema,
  spec,
  "resume",
  Effect.fn("contentRelease.models.resume")(function* ({
    generation,
    releaseId,
  }) {
    const ctx = yield* MutationCtxService;
    return yield* resumeModelBuild(ctx, releaseId, generation);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(restart),
  Layer.provide(status),
  Layer.provide(resume),
  GroupImpl.finalize
);
