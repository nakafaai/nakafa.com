import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { Ed25519SignatureSchema } from "@nakafa/aksara-contracts/ids";
import {
  encodeArtifactJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testProofRenderer } from "@repo/backend/test/content/proof";
import { Data, Effect, Schema } from "effect";

class InvalidDriftFixture extends Data.TaggedError("InvalidDriftFixture")<{
  operation: "load-proof-release" | "load-staged-artifact";
}> {}

/** Changes only the stored signature while preserving its claimed identity. */
const tamperArtifactSignature = Effect.fn(
  "contentRelease.proof.verify.test.tamperArtifactSignature"
)(function* (artifactJson: string) {
  const artifact = yield* Schema.decodeEffect(
    Schema.fromJsonString(SignedContentArtifactSchema)
  )(artifactJson);
  const firstCharacter = artifact.signature.startsWith("A") ? "B" : "A";
  const signature = Ed25519SignatureSchema.make(
    `${firstCharacter}${artifact.signature.slice(1)}`
  );
  return encodeArtifactJson({
    ...artifact,
    signature,
  });
});

/** Loads one staged proof release or defects on an invalid fixture. */
const loadProofRelease = Effect.fn(
  "contentRelease.proof.verify.test.loadProofRelease"
)(function* (ctx: MutationCtx) {
  const release = yield* Effect.promise(() =>
    ctx.db.query("contentReleases").unique()
  );
  if (!release) {
    return yield* Effect.die(
      new InvalidDriftFixture({
        operation: "load-proof-release",
      })
    );
  }
  return release;
});

/** Corrupts the frozen renderer while preserving the release identity. */
export const driftStoredRenderer = Effect.fn(
  "contentRelease.proof.verify.test.driftStoredRenderer"
)(function* (ctx: MutationCtx) {
  const release = yield* loadProofRelease(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      rendererJson: encodeRendererJson(testProofRenderer("h1")),
    })
  );
});

/** Corrupts durable counters after the release entered verification. */
export const driftDurableCounters = Effect.fn(
  "contentRelease.proof.verify.test.driftDurableCounters"
)(function* (ctx: MutationCtx) {
  const release = yield* loadProofRelease(ctx);
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedItems: 1,
      status: "verifying",
    })
  );
});

/** Corrupts one staged artifact signature inside the real test transaction. */
export const tamperStoredArtifact = Effect.fn(
  "contentRelease.proof.verify.test.tamperStoredArtifact"
)(function* (ctx: MutationCtx) {
  const artifact = yield* Effect.promise(() =>
    ctx.db.query("contentArtifacts").unique()
  );
  if (!artifact) {
    return yield* Effect.die(
      new InvalidDriftFixture({
        operation: "load-staged-artifact",
      })
    );
  }
  const artifactJson = yield* tamperArtifactSignature(
    artifact.artifactJson
  ).pipe(Effect.orDie);
  yield* Effect.promise(() =>
    ctx.db.patch("contentArtifacts", artifact._id, {
      artifactJson,
    })
  );
});
