import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { stageProgram } from "@repo/backend/confect/contentRelease/artifacts";
import spec from "@repo/backend/confect/contentRelease/artifacts.spec";
import { Effect, Layer } from "effect";

/** Decodes one bounded artifact batch through the shared wire contract. */
const stageArtifactBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageArtifactBatch",
  Effect.fn("contentRelease.artifacts.stageArtifactBatch")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* stageProgram(
      ctx,
      args.releaseId,
      args.batchIndex,
      args.artifactJson
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageArtifactBatch),
  GroupImpl.finalize
);
