import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_PROOF_RENDERER,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { Schema } from "effect";

interface ProtectedRuntimeFixture {
  readonly answer: ProtectedContentRuntimeRequest;
  readonly placement: TryoutPlacement;
  readonly question: ProtectedContentRuntimeRequest;
  readonly snapshotId: string;
}

/** Builds one exact protected selector from a signed placement body. */
function protectedRequest(
  placement: TryoutPlacement,
  snapshotId: string,
  snapshotReleaseId: string,
  delivery: "authenticated" | "entitled"
) {
  const question = delivery === "authenticated";
  return Schema.decodeUnknownSync(ProtectedContentRuntimeRequestSchema)({
    artifactHash: question
      ? placement.questionArtifactHash
      : placement.answerArtifactHash,
    contentKey: question
      ? placement.questionContentKey
      : placement.answerContentKey,
    delivery,
    locale: placement.locale,
    snapshotReleaseId,
    snapshotId,
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
    contentKey: enQuestion.payload.contentKey,
    locale: "id",
    rawMdx: "## Pertanyaan teknis",
  });
  const idAnswer = testSignedArtifact("snbt-quant", {
    contentKey: enAnswer.payload.contentKey,
    locale: "id",
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
  const signedRelease = testSignedRelease({
    ...storedRelease.manifest,
    rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
    rendererManifestHash: TEST_PROOF_RENDERER.hash,
  });
  await ctx.db.insert("tryoutBundles", {
    createdAt: 1,
    index: 0,
    manifestHash: signedRelease.manifestHash,
    releaseId: signedRelease.manifest.releaseId,
    releaseJson: JSON.stringify(signedRelease),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    snapshotId,
  });
  await Promise.all(
    [enQuestion, enAnswer, idQuestion, idAnswer].map((artifact) =>
      insertArtifact(ctx, artifact)
    )
  );
  return {
    answer: protectedRequest(
      enPlacement,
      snapshotId,
      signedRelease.manifest.releaseId,
      "entitled"
    ),
    placement: enPlacement,
    question: protectedRequest(
      enPlacement,
      snapshotId,
      signedRelease.manifest.releaseId,
      "authenticated"
    ),
    snapshotId,
  };
}
