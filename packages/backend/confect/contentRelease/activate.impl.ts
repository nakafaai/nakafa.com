import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contentRelease/activate.spec";
import {
  activateCandidate,
  prepareCandidate,
} from "@repo/backend/confect/contentRelease/activation/candidate";
import {
  activateRecovery as activateRecoveryProgram,
  prepareRecovery as prepareRecoveryProgram,
} from "@repo/backend/confect/contentRelease/activation/recovery";
import { Effect, Layer } from "effect";

const prepare = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepare",
  Effect.fn("contentRelease.activate.prepare")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* prepareCandidate(
      ctx,
      args.releaseId,
      args.rendererJson,
      args.manifestHash
    );
  })
);
const activate = FunctionImpl.make(
  databaseSchema,
  spec,
  "activate",
  Effect.fn("contentRelease.activate.activate")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* activateCandidate(
      ctx,
      args.releaseId,
      args.rendererJson,
      args.manifestHash
    );
  })
);
const prepareRecovery = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepareRecovery",
  Effect.fn("contentRelease.activate.prepareRecovery")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* prepareRecoveryProgram(
      ctx,
      args.releaseId,
      args.rendererJson,
      args.manifestHash
    );
  })
);
const activateRecovery = FunctionImpl.make(
  databaseSchema,
  spec,
  "activateRecovery",
  Effect.fn("contentRelease.activate.activateRecovery")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* activateRecoveryProgram(
      ctx,
      args.releaseId,
      args.rendererJson,
      args.manifestHash
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(prepare),
  Layer.provide(activate),
  Layer.provide(prepareRecovery),
  Layer.provide(activateRecovery),
  GroupImpl.finalize
);
