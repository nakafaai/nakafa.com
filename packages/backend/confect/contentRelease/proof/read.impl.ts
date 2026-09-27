import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import {
  artifactBatchProgram,
  artifactPlanProgram,
  pageProgram,
  routePageProgram,
  stateProgram,
} from "@repo/backend/confect/contentRelease/proof/read";
import spec from "@repo/backend/confect/contentRelease/proof/read.spec";
import { Effect, Layer } from "effect";

const state = FunctionImpl.make(
  databaseSchema,
  spec,
  "state",
  Effect.fn("contentRelease.proof.read.state")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* stateProgram(ctx, args.manifestHash, args.releaseId);
  })
);
const artifactPlan = FunctionImpl.make(
  databaseSchema,
  spec,
  "artifactPlan",
  Effect.fn("contentRelease.proof.read.artifactPlan")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* artifactPlanProgram(ctx, args.manifestHash, args.releaseId);
  })
);
const artifactBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "artifactBatch",
  Effect.fn("contentRelease.proof.read.artifactBatch")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* artifactBatchProgram(ctx, args.releaseId, args.batchIndex);
  })
);
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.proof.read.page")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* pageProgram(ctx, args.afterIndex, args.releaseId);
  })
);
const routePage = FunctionImpl.make(
  databaseSchema,
  spec,
  "routePage",
  Effect.fn("contentRelease.proof.read.routePage")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* routePageProgram(ctx, args.afterIndex, args.releaseId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(state),
  Layer.provide(artifactPlan),
  Layer.provide(artifactBatch),
  Layer.provide(page),
  Layer.provide(routePage),
  GroupImpl.finalize
);
