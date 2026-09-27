import { FunctionImpl, GroupImpl } from "@confect/server";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ActionCtx as ActionCtxService } from "@repo/backend/confect/_generated/services";
import {
  recomputeProgram,
  verifyArtifactBatchProgram,
} from "@repo/backend/confect/contentRelease/proof/verify";
import spec from "@repo/backend/confect/contentRelease/proof/verify.spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect, Layer } from "effect";

const verifyArtifacts = FunctionImpl.make(
  databaseSchema,
  spec,
  "verifyArtifacts",
  Effect.fn("contentRelease.proof.verify.verifyArtifacts")(function* (args) {
    const ctx = yield* ActionCtxService;
    return yield* verifyArtifactBatchProgram(
      ctx,
      args.manifestHash,
      args.releaseId,
      args.batchIndex
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    );
  })
);
const verifyRelease = FunctionImpl.make(
  databaseSchema,
  spec,
  "verifyRelease",
  Effect.fn("contentRelease.proof.verify.verifyRelease")(function* (args) {
    const ctx = yield* ActionCtxService;
    return yield* recomputeProgram(
      ctx,
      args.manifestHash,
      args.releaseId,
      args.verifiedArtifacts
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
      Effect.as(null)
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(verifyArtifacts),
  Layer.provide(verifyRelease),
  GroupImpl.finalize
);
