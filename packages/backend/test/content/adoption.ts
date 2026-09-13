import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { replaceContentSnapshot } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement-hash";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { AdoptionCommit } from "@repo/backend/convex/contentRelease/adoption/spec";
import {
  hashAdoptionState,
  readAdoptionState,
} from "@repo/backend/convex/contentRelease/adoption/state";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  decodeReleaseJson,
  decodeSnapshotRowJson,
  decodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/parse";
import { tryoutPlacementFacts } from "@repo/backend/convex/contentRelease/tryout/facts";
import {
  TEST_PROOF_RENDERER,
  testSignedArtifact,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { testTextHash } from "@repo/backend/test/content/release";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { Effect } from "effect";

/** Seeds the private transaction boundary after its separate Node authenticator. */
export async function insertAdoptionHistory(
  ctx: MutationCtx,
  preserveBodies = false
) {
  const seed = await insertHistoryAttempt(ctx);
  const attempt = await ctx.db.get("tryoutAttempts", seed.request.attemptId);
  const active = await ctx.db.query("contentReleases").unique();
  const singleton = await ctx.db.query("contentState").unique();
  if (!(attempt && active && singleton)) {
    throw new Error("Expected technical retained history.");
  }
  const scoreId = await ctx.db.insert("tryoutScores", {
    tryoutAttemptId: attempt._id,
    tryoutSnapshotId: attempt.tryoutSnapshotId,
    setIdentity: attempt.setIdentity,
    userId: attempt.userId,
    scoringStrategy: "irt",
    scoreStatus: "provisional",
    rawScore: 1,
    totalCorrect: 1,
    totalQuestions: 1,
    publishedScore: 500,
    finalizedAt: 123,
  });
  const responseId = await ctx.db.insert("tryoutResponses", {
    tryoutAttemptId: attempt._id,
    tryoutSectionAttemptId: seed.sectionId,
    placementId: seed.placementId,
    selection: { kind: "single-choice", optionKey: "a" },
    isComplete: true,
    isCorrect: true,
    timeSpent: 17,
    answeredAt: 120,
    updatedAt: 120,
  });
  const retained = await ctx.db.get("tryoutPlacements", seed.retainedId);
  if (!retained) {
    throw new Error("Expected retained placement.");
  }
  const scaleId = await ctx.db.insert("irtScaleVersions", {
    tryoutSnapshotId: attempt.tryoutSnapshotId,
    setIdentity: attempt.setIdentity,
    model: "2pl",
    status: "provisional",
    questionCount: 1,
    publishedAt: 1,
  });
  const sectionSnapshot = attempt.sectionSnapshots[0];
  if (!sectionSnapshot) {
    throw new Error("Expected a frozen section.");
  }
  const runId = await ctx.db.insert("irtCalibrationRuns", {
    scaleVersionId: scaleId,
    sectionIdentity: sectionSnapshot.sectionIdentity,
    model: "2pl",
    status: "completed",
    questionCount: 1,
    responseCount: 1,
    attemptCount: 1,
    iterationCount: 2,
    maxParameterDelta: 0.01,
    startedAt: 1,
    updatedAt: 2,
    completedAt: 2,
  });
  const itemId = await ctx.db.insert("irtScaleItems", {
    scaleVersionId: scaleId,
    calibrationRunId: runId,
    placementIdentity: retained.identity,
    placementRowHash: retained.rowHash,
    difficulty: 0.1,
    discrimination: 1.2,
    responseCount: 1,
    correctRate: 1,
    calibrationStatus: "provisional",
  });
  await ctx.db.patch("tryoutAttempts", attempt._id, {
    scaleVersionId: scaleId,
  });
  await ctx.db.patch("tryoutScores", scoreId, { scaleVersionId: scaleId });
  const decoded = await Effect.runPromise(
    decodeSnapshotRowJson(retained.rowJson)
  );
  const oldBundle = await Effect.runPromise(
    decodeTryoutRuntimeBundleJson(seed.runtime.bundleJson)
  );
  const originalRelease = await Effect.runPromise(
    decodeReleaseJson(active.releaseJson)
  );
  if (decoded.family !== "tryout" || decoded.rowKind !== "placement") {
    throw new Error("Expected one technical placement.");
  }
  const question = testSignedArtifact("snbt-quant", {
    contentKey: decoded.record.row.questionContentKey,
    rawMdx: preserveBodies ? "## Technical question" : "## Candidate question",
  });
  const answer = testSignedArtifact("snbt-quant", {
    contentKey: decoded.record.row.answerContentKey,
    rawMdx: preserveBodies ? "#### Technical answer" : "#### Candidate answer",
  });
  for (const artifact of preserveBodies ? [] : [question, answer]) {
    await ctx.db.insert("contentArtifacts", {
      artifactHash: artifact.artifactHash,
      artifactJson: JSON.stringify(artifact),
      createdAt: 1,
      retainUntil: 999,
    });
  }
  const record = makeTryoutPlacementRecord({
    ...decoded.record.row,
    questionArtifactHash: question.artifactHash,
    answerArtifactHash: answer.artifactHash,
  });
  const snapshot = makeTryoutSnapshot({
    ...oldBundle.payload.snapshot,
    placementDigest: testTextHash("verified candidate placement stream"),
  });
  const newSnapshotId = snapshot.snapshotId;
  const candidate = testSignedRelease({
    ...originalRelease.manifest,
    releaseId: ReleaseIdSchema.make("history-adoption"),
    snapshots: {
      ...originalRelease.manifest.snapshots,
      tryout: replaceContentSnapshot({
        baseSnapshotId: null,
        resultSnapshotId: newSnapshotId,
        rowCount: 4,
        rowDigest: newSnapshotId,
      }),
    },
  });
  const bundle = testSignedTryoutRuntimeBundle({
    release: candidate,
    rendererManifest: TEST_PROOF_RENDERER,
    snapshot,
  });
  const newBundleId = await ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash: bundle.bundleHash,
    bundleJson: JSON.stringify(bundle),
    createdAt: 1,
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    rendererManifestHash: TEST_PROOF_RENDERER.hash,
    snapshotId: newSnapshotId,
    sourceReleaseId: candidate.manifest.releaseId,
    sourceManifestHash: candidate.manifestHash,
    sourceGitSha: bundle.payload.sourceGitSha,
  });
  await ctx.db.insert("contentSnapshots", {
    family: "tryout",
    snapshotId: newSnapshotId,
    snapshotJson: JSON.stringify({ family: "tryout", manifest: snapshot }),
    createdAt: 1,
    retainUntil: 999,
    verifiedAt: 1,
  });
  const { _id, _creationTime, ...priorPlacement } = retained;
  await ctx.db.insert("tryoutPlacements", {
    ...priorPlacement,
    ...tryoutPlacementFacts(record),
    rowHash: record.rowHash,
    rowJson: JSON.stringify({ family: "tryout", rowKind: "placement", record }),
    snapshotId: newSnapshotId,
  });
  const { manifest } = candidate;
  const proof = {
    ...manifest,
    manifestHash: candidate.manifestHash,
    deleteHeads: manifest.deleteCount,
    upsertHeads: manifest.upsertCount,
    stagedArtifacts: manifest.upsertCount,
    stagedRoutes: manifest.routeCount,
    stagedSnapshotRows: 4,
  };
  const { origin, format, scope, deleteCount, upsertCount, ...proofFields } =
    proof;
  const {
    _id: activeId,
    _creationTime: activeCreatedAt,
    ...releaseFields
  } = active;
  const candidateId = await ctx.db.insert("contentReleases", {
    ...releaseFields,
    releaseId: candidate.manifest.releaseId,
    releaseJson: JSON.stringify(candidate),
    sequence: 2,
    role: "candidate",
    status: "verified",
    verifiedAt: 1,
    proofAt: 1,
    proofJson: JSON.stringify(proofFields),
    tryoutRuntimeBundleHash: bundle.bundleHash,
  });
  await ctx.db.patch("contentState", singleton._id, {
    candidateReleaseId: candidate.manifest.releaseId,
    candidateSequence: 2,
    candidateManifestHash: candidate.manifestHash,
    nextSequence: 3,
  });
  const identity = {
    candidateReleaseId: candidate.manifest.releaseId,
    candidateManifestHash: candidate.manifestHash,
    oldBundleHash: seed.runtime.bundleHash,
    newBundleHash: bundle.bundleHash,
  };
  const state = await Effect.runPromise(readAdoptionState(ctx, identity));
  const artifacts: AdoptionCommit["artifacts"] = [];
  for (const artifactHash of new Set(
    state.placements.flatMap(({ prior, next }) => [
      prior.questionArtifactHash,
      prior.answerArtifactHash,
      next.questionArtifactHash,
      next.answerArtifactHash,
    ])
  )) {
    const artifact = await ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (q) => q.eq("artifactHash", artifactHash))
      .unique();
    if (!artifact) {
      throw new Error("Expected authenticated artifact bytes.");
    }
    artifacts.push({
      artifactHash,
      jsonHash: await Effect.runPromise(
        hashText("adoption artifact bytes", artifact.artifactJson)
      ),
    });
  }
  return {
    seed,
    identity,
    candidateId,
    newBundleId,
    scaleId,
    itemId,
    scoreId,
    responseId,
    runId,
    state,
    commit: {
      ...identity,
      expectedHistoryHash: state.historyHash,
      stateHash: await Effect.runPromise(hashAdoptionState(state)),
      artifacts,
    },
  };
}
