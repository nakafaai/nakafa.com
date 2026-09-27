import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { abortProgram } from "@repo/backend/confect/contentRelease/abort";
import { stageProgram } from "@repo/backend/confect/contentRelease/manifest";
import spec from "@repo/backend/confect/contentRelease/manifest.spec";
import { Effect, Layer } from "effect";

const stageRelease = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageRelease",
  Effect.fn("contentRelease.manifest.stageRelease")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* stageProgram(
      ctx,
      "candidate",
      args.releaseJson,
      args.rendererJson
    );
  })
);
const stageRecovery = FunctionImpl.make(
  databaseSchema,
  spec,
  "stageRecovery",
  Effect.fn("contentRelease.manifest.stageRecovery")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* stageProgram(
      ctx,
      "recovery",
      args.releaseJson,
      args.rendererJson
    );
  })
);
const abort = FunctionImpl.make(
  databaseSchema,
  spec,
  "abort",
  Effect.fn("contentRelease.manifest.abort")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* abortProgram(ctx, args.releaseId);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(stageRelease),
  Layer.provide(stageRecovery),
  Layer.provide(abort),
  GroupImpl.finalize
);
