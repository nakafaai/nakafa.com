import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
    return yield* stateProgram(args.manifestHash, args.releaseId);
  })
);
const artifactPlan = FunctionImpl.make(
  databaseSchema,
  spec,
  "artifactPlan",
  Effect.fn("contentRelease.proof.read.artifactPlan")(function* (args) {
    return yield* artifactPlanProgram(args.manifestHash, args.releaseId);
  })
);
const artifactBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "artifactBatch",
  Effect.fn("contentRelease.proof.read.artifactBatch")(function* (args) {
    return yield* artifactBatchProgram(args.releaseId, args.batchIndex);
  })
);
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.proof.read.page")(function* (args) {
    return yield* pageProgram(args.afterIndex, args.releaseId);
  })
);
const routePage = FunctionImpl.make(
  databaseSchema,
  spec,
  "routePage",
  Effect.fn("contentRelease.proof.read.routePage")(function* (args) {
    return yield* routePageProgram(args.afterIndex, args.releaseId);
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
