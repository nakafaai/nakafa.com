import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { commitProgram } from "@repo/backend/confect/contentRelease/proof/commit";
import spec from "@repo/backend/confect/contentRelease/proof/commit.spec";
import { Effect, Layer } from "effect";

const commitProof = FunctionImpl.make(
  databaseSchema,
  spec,
  "commitProof",
  Effect.fn("contentRelease.proof.commit.commitProof")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* commitProgram(ctx, args.proofJson);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(commitProof),
  GroupImpl.finalize
);
