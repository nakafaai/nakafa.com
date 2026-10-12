import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/activate.spec";
import {
  activateCandidate,
  prepareCandidate,
} from "@repo/backend/confect/contentRelease/activation/candidate";
import {
  activateRecovery as activateRecoveryProgram,
  prepareRecovery as prepareRecoveryProgram,
} from "@repo/backend/confect/contentRelease/activation/recovery";
import { startSectionBuild } from "@repo/backend/confect/contents/sections/start";
import { Effect, Layer } from "effect";

const prepare = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepare",
  Effect.fn("contentRelease.activate.prepare")(function* (args) {
    return yield* prepareCandidate(
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
    const result = yield* activateCandidate(
      args.releaseId,
      args.rendererJson,
      args.manifestHash
    );
    // Scheduled in the transaction that makes the release active, so the
    // build is queued exactly when the activation commits, and a repeated
    // activation, which finds the release completed, queues nothing.
    if (result.kind === "activated") {
      yield* startSectionBuild(args.releaseId);
    }
    return result;
  })
);
const prepareRecovery = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepareRecovery",
  Effect.fn("contentRelease.activate.prepareRecovery")(function* (args) {
    return yield* prepareRecoveryProgram(
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
    const result = yield* activateRecoveryProgram(
      args.releaseId,
      args.rendererJson,
      args.manifestHash
    );
    if (result.kind === "activated") {
      yield* startSectionBuild(args.releaseId);
    }
    return result;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(prepare),
  Layer.provide(activate),
  Layer.provide(prepareRecovery),
  Layer.provide(activateRecovery),
  GroupImpl.finalize
);
