import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { stageProgram } from "@repo/backend/confect/contentRelease/artifacts";
import spec from "@repo/backend/confect/contentRelease/artifacts.spec";
import { Effect, Layer } from "effect";

/** Stages one bounded artifact batch from the header of each authenticated artifact. */
const stageArtifactBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageArtifactBatch",
  Effect.fn("contentRelease.artifacts.stageArtifactBatch")(function* (args) {
    return yield* stageProgram(
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
