import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ProofPollCoordinatorLive,
  pollProgram,
} from "@repo/backend/confect/contentRelease/proof/poll";
import spec from "@repo/backend/confect/contentRelease/proof/poll.spec";
import { Effect, Layer } from "effect";

const poll = FunctionImpl.make(
  databaseSchema,
  spec,
  "poll",
  Effect.fn("contentRelease.proof.poll.poll")(function* (args) {
    return yield* pollProgram(args.manifestHash, args.releaseId).pipe(
      Effect.provide(ProofPollCoordinatorLive)
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(poll),
  GroupImpl.finalize
);
