import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { ContentSnapshotManifestSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  type ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeRequestSchema,
  type ProtectedContentRuntimeSelector,
  ProtectedContentRuntimeSelectorSchema,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import {
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/placement";
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
  ctx: MutationCtx,
  options?: {
    readonly answerCompiledCode?: string;
    readonly answerRawMdx?: string;
    readonly compiledCode?: string;
    readonly questionCount?: number;
    readonly rawMdx?: string;
  }
): Promise<ProtectedRuntimeFixture> {
  const locales = ["en", "id"] as const;
  const bodies = locales.flatMap((appLocale) =>
    Array.from({ length: options?.questionCount ?? 1 }, (_, index) => {
      const questionKey = `question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-${index + 1}`;
      const question = testSignedArtifact("snbt-quant", {
        artifactLocale: appLocale,
        compiledCode: options?.compiledCode,
        contentKey: `${questionKey}/question`,
        rawMdx:
          appLocale === "en"
            ? (options?.rawMdx ?? "## Technical question")
            : "## Pertanyaan teknis",
      });
      const answer = testSignedArtifact("snbt-quant", {
        artifactLocale: appLocale,
        compiledCode: options?.answerCompiledCode ?? options?.compiledCode,
        contentKey: `${questionKey}/answer`,
        rawMdx:
          appLocale === "en"
            ? (options?.answerRawMdx ?? "#### Technical answer")
            : "#### Jawaban teknis",
      });
      const placement = Schema.decodeSync(TryoutPlacementSchema)({
        ...makeTryoutPlacementRow(appLocale, {
          answerArtifactHash: answer.artifactHash,
          questionArtifactHash: question.artifactHash,
        }).record.row,
        answerContentKey: answer.payload.contentKey,
        questionContentKey: question.payload.contentKey,
        questionOrder: index + 1,
        questionSourcePath: `packages/corpus/${questionKey}`,
      });
      return { answer, placement, question };
    })
  );
  const english = bodies.filter(
    ({ placement }) => placement.appLocale === "en"
  );
  const first = english[0];
  if (!first) {
    throw new Error("Expected a protected runtime question.");
  }
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog: [
      makeTryoutCatalogRow("en").record.row,
      makeTryoutCatalogRow("id").record.row,
    ],
    placements: bodies.map(({ placement }) => placement),
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
    bodies
      .flatMap(({ question, answer }) => [question, answer])
      .map((artifact) => insertArtifact(ctx, artifact))
  );
  const question = protectedSelector(first.placement, "authenticated");
  const answer = protectedSelector(first.placement, "entitled");
  const request = Schema.decodeSync(ProtectedContentRuntimeRequestSchema)({
    bundleHash: bundle.bundleHash,
    selectors: english.flatMap(({ placement }) => [
      protectedSelector(placement, "authenticated"),
      protectedSelector(placement, "entitled"),
    ]),
    snapshotId,
  });
  return {
    answer,
    placement: first.placement,
    question,
    request,
    runtimeId,
    snapshotId,
  };
}
