import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { ContentSnapshotManifestSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
  type ProtectedContentRuntimeSelector,
  ProtectedContentRuntimeSelectorSchema,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/placement";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_PROOF_RENDERER,
  testSignedArtifact,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { Schema } from "effect";

interface ProtectedRuntimeFixture {
  readonly answer: ProtectedContentRuntimeSelector;
  readonly placement: TryoutPlacement;
  readonly question: ProtectedContentRuntimeSelector;
  readonly request: ProtectedContentRuntimeRequest;
  readonly runtimeId: Id<"tryoutRuntimeBundles">;
  readonly snapshotId: ProtectedContentRuntimeRequest["snapshotId"];
}

/** Builds one exact protected selector from a signed placement body. */
function protectedSelector(
  placement: TryoutPlacement,
  delivery: "authenticated" | "entitled"
) {
  const question = delivery === "authenticated";
  return Schema.decodeSync(ProtectedContentRuntimeSelectorSchema)({
    artifactHash: question
      ? placement.questionArtifactHash
      : placement.answerArtifactHash,
    contentKey: question
      ? placement.questionContentKey
      : placement.answerContentKey,
    delivery,
  });
}

/** Inserts one signed artifact with immutable retention. */
function insertArtifact(
  ctx: MutationCtx,
  artifact: ReturnType<typeof testSignedArtifact>
) {
  return ctx.db.insert("contentArtifacts", {
    artifactHash: artifact.artifactHash,
    artifactJson: JSON.stringify(artifact),
    createdAt: 1,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
}

/** Activates signed protected question and answer artifacts for runtime tests. */
export async function insertProtectedRuntime(
  ctx: MutationCtx
): Promise<ProtectedRuntimeFixture> {
  const enQuestion = testSignedArtifact("snbt-quant", {
    contentKey:
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
    rawMdx: "## Technical question",
  });
  const enAnswer = testSignedArtifact("snbt-quant", {
    contentKey:
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/answer",
    rawMdx: "#### Technical answer",
  });
  const idQuestion = testSignedArtifact("snbt-quant", {
    artifactLocale: "id",
    contentKey: enQuestion.payload.contentKey,
    rawMdx: "## Pertanyaan teknis",
  });
  const idAnswer = testSignedArtifact("snbt-quant", {
    artifactLocale: "id",
    contentKey: enAnswer.payload.contentKey,
    rawMdx: "#### Jawaban teknis",
  });
  const enPlacement = makeTryoutPlacementRow("en", {
    answerArtifactHash: enAnswer.artifactHash,
    questionArtifactHash: enQuestion.artifactHash,
  }).record.row;
  const idPlacement = makeTryoutPlacementRow("id", {
    answerArtifactHash: idAnswer.artifactHash,
    questionArtifactHash: idQuestion.artifactHash,
  }).record.row;
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog: [
      makeTryoutCatalogRow("en").record.row,
      makeTryoutCatalogRow("id").record.row,
    ],
    placements: [enPlacement, idPlacement],
  });
  const [release, state] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db.query("contentState").unique(),
  ]);
  if (!(release && state)) {
    throw new Error("Expected protected runtime release state.");
  }
  const storedRelease = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
    JSON.parse(release.releaseJson)
  );
  const storedSnapshot = await ctx.db
    .query("contentSnapshots")
    .withIndex("by_family_and_snapshotId", (index) =>
      index.eq("family", "tryout").eq("snapshotId", snapshotId)
    )
    .unique();
  if (!storedSnapshot) {
    throw new Error("Expected protected runtime snapshot.");
  }
  const snapshot = Schema.decodeUnknownSync(ContentSnapshotManifestSchema)(
    JSON.parse(storedSnapshot.snapshotJson)
  );
  if (snapshot.family !== "tryout") {
    throw new Error("Expected a try-out snapshot manifest.");
  }
  const signedRelease = testSignedRelease({
    ...storedRelease.manifest,
    rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
    rendererManifestHash: TEST_PROOF_RENDERER.hash,
  });
  const bundle = testSignedTryoutRuntimeBundle({
    release: signedRelease,
    rendererManifest: TEST_PROOF_RENDERER,
    snapshot: snapshot.manifest,
  });
  const runtimeId = await ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash: bundle.bundleHash,
    bundleJson: JSON.stringify(bundle),
    cleanupReleaseId: bundle.payload.sourceReleaseId,
    createdAt: 1,
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    rendererManifestHash: bundle.payload.rendererManifestHash,
    snapshotId,
    sourceGitSha: bundle.payload.sourceGitSha,
    sourceManifestHash: bundle.payload.sourceManifestHash,
    sourceReleaseId: bundle.payload.sourceReleaseId,
  });
  await ctx.db.patch(release._id, {
    releaseJson: JSON.stringify(signedRelease),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    tryoutRuntimeBundleHash: bundle.bundleHash,
  });
  await Promise.all(
    [enQuestion, enAnswer, idQuestion, idAnswer].map((artifact) =>
      insertArtifact(ctx, artifact)
    )
  );
  const question = protectedSelector(enPlacement, "authenticated");
  const answer = protectedSelector(enPlacement, "entitled");
  const request = Schema.decodeSync(ProtectedContentRuntimeRequestSchema)({
    bundleHash: bundle.bundleHash,
    selectors: [question, answer],
    snapshotId,
  });
  return {
    answer,
    placement: enPlacement,
    question,
    request,
    runtimeId,
    snapshotId,
  };
}
