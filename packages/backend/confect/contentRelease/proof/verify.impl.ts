import { FunctionImpl, GroupImpl } from "@confect/server";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  recomputeProgram,
  verifyArtifactBatchProgram,
  verifySnapshotFamilyProgram,
} from "@repo/backend/confect/contentRelease/proof/verify";
import spec from "@repo/backend/confect/contentRelease/proof/verify.spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect, Layer } from "effect";

const verifyArtifacts = FunctionImpl.make(
  databaseSchema,
  spec,
  "verifyArtifacts",
  Effect.fn("contentRelease.proof.verify.verifyArtifacts")(function* (args) {
    return yield* verifyArtifactBatchProgram(
      args.manifestHash,
      args.releaseId,
      args.batchIndex
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
    );
  })
);
const verifySnapshots = FunctionImpl.make(
  databaseSchema,
  spec,
  "verifySnapshots",
  Effect.fn("contentRelease.proof.verify.verifySnapshots")(function* (args) {
    return yield* verifySnapshotFamilyProgram(
      args.manifestHash,
      args.releaseId,
      args.family
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
    return yield* recomputeProgram(
      args.manifestHash,
      args.releaseId,
      args.verifiedArtifacts,
      args.snapshotProofs
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
      Effect.as(null)
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(verifyArtifacts),
  Layer.provide(verifySnapshots),
  Layer.provide(verifyRelease),
  GroupImpl.finalize
);
