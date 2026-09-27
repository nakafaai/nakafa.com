import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
    return yield* restartModelBuild(args);
  })
);
const status = FunctionImpl.make(
  databaseSchema,
  spec,
  "status",
  Effect.fn("contentRelease.models.status")(function* ({ releaseId }) {
    return yield* readModelStatus(releaseId);
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
    return yield* resumeModelBuild(releaseId, generation);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(restart),
  Layer.provide(status),
  Layer.provide(resume),
  GroupImpl.finalize
);
