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
    return yield* activateCandidate(
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
    return yield* activateRecoveryProgram(
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
