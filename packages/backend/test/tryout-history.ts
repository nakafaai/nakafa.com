import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { RetainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import {
  TEST_MANIFEST_HASH,
  testPublicationScope,
} from "@repo/backend/test/content-release";
import { insertTryoutUser } from "@repo/backend/test/tryout-runtime";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 13, 10, 0, 0);

export function provideHistoryTestTrust<A, E, R>(
  program: Effect.Effect<A, E, R>
) {
  return program.pipe(
    Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
  );
}

async function insertRetainedAttempt(
  ctx: MutationCtx,
  input: {
    readonly frozenContentHash?: string;
    readonly frozenSourcePath?: string;
    readonly placement: TryoutPlacement;
    readonly releaseId: string;
    readonly snapshotId: string;
    readonly suffix: string;
  }
) {
  const placement = makeTryoutPlacementRow(
    input.placement.locale,
    input.placement
  ).record;
  const row = placement.row;
  const userId = await insertTryoutUser(ctx, {
    authId: `auth-history-${input.suffix}`,
    email: `history-${input.suffix}@example.com`,
    name: `History ${input.suffix}`,
  });
  const sectionIdentity = tryoutCatalogIdentity({
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "section",
    locale: row.locale,
    sectionKey: row.sectionKey,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
  const setIdentity = tryoutCatalogIdentity({
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "set",
    locale: row.locale,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: NOW + 86_400_000,
    accessSourceKind: "free",
    appLocale: row.locale,
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    countsForCompetition: false,
    countryKey: row.countryKey,
    endReason: null,
    examKey: row.examKey,
    expiresAt: NOW + 86_400_000,
    lastActivityAt: NOW,
    locale: row.locale,
    scoreStatus: "official",
    scoringStrategy: "raw",
    sectionSnapshots: [
      {
        questionCount: 1,
        questionSourcePath: row.questionSourcePath,
        sectionIdentity,
        sectionKey: row.sectionKey,
        sectionOrder: 1,
        sectionRowHash: placement.rowHash,
        sourceRevision: row.sourceRevision,
        timeLimitSeconds: 1800,
      },
    ],
    setIdentity,
    setKey: row.setKey,
    setPublicPath: `try-out/${row.countryKey}/${row.examKey}/${row.trackKey}/${row.setKey}`,
    snapshotReleaseId: input.releaseId,
    startedAt: NOW,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions: 1,
    trackKey: row.trackKey,
    tryoutSnapshotId: input.snapshotId,
    userId,
  });
  await ctx.db.insert("tryoutAttemptPlacements", {
    answerArtifactHash: row.answerArtifactHash,
    answerContentKey: row.answerContentKey,
    choiceSnapshots: [...row.choices],
    contentHash: input.frozenContentHash ?? row.contentHash,
    placementIdentity: tryoutPlacementIdentity(row),
    placementRowHash: placement.rowHash,
    questionArtifactHash: row.questionArtifactHash,
    questionContentKey: row.questionContentKey,
    questionOrder: row.questionOrder,
    rendererDomain: row.rendererDomain,
    sectionIdentity,
    sectionKey: row.sectionKey,
    sourcePath: input.frozenSourcePath ?? row.questionSourcePath,
    sourceRevision: row.sourceRevision,
    title: row.title,
    tryoutAttemptId: attemptId,
  });
  return { attemptId, userId };
}

export async function seedRetainedTryoutHistory(ctx: MutationCtx) {
  const catalog = [
    makeTryoutCatalogRow("en").record.row,
    makeTryoutCatalogRow("id").record.row,
  ];
  const placementSources = [
    makeTryoutPlacementRow("en").record.row,
    makeTryoutPlacementRow("id").record.row,
  ];
  const signedArtifacts = placementSources.map((placement, index) => ({
    answer: testSignedArtifact(placement.rendererDomain, {
      contentKey: placement.answerContentKey,
      locale: placement.locale,
    }),
    question: testSignedArtifact(placement.rendererDomain, {
      contentKey: placement.questionContentKey,
      locale: index === 1 ? "en" : placement.locale,
      rawMdx: `## Retained question ${index}`,
    }),
  }));
  const placements = placementSources.map((placement, index) => {
    const artifacts = signedArtifacts[index];
    if (!artifacts) {
      throw new Error(`Expected retained artifact fixture ${index}.`);
    }
    return makeTryoutPlacementRow(placement.locale, {
      answerArtifactHash: artifacts.answer.artifactHash,
      questionArtifactHash: artifacts.question.artifactHash,
    }).record.row;
  });
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog,
    placements,
  });
  const snapshots = {
    ...inheritContentSnapshots(null),
    tryout: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshotId,
      rowCount: catalog.length + placements.length,
      rowDigest: snapshotId,
    }),
  };
  const signedReleases = ["retained-history-a", "retained-history-b"].map(
    (value) => {
      const releaseId = ReleaseIdSchema.make(value);
      return testSignedRelease({
        ...testEmptyManifest(releaseId),
        baseManifestHash: TEST_MANIFEST_HASH,
        baseReleaseId: ReleaseIdSchema.make("retained-history-base"),
        scope: testPublicationScope({ snapshots }),
        snapshots,
      });
    }
  );
  const firstRelease = signedReleases[0];
  const secondRelease = signedReleases[1];
  const firstPlacement = placements[0];
  const secondPlacement = placements[1];
  if (!(firstRelease && secondRelease && firstPlacement && secondPlacement)) {
    throw new Error("Expected two retained release and placement fixtures.");
  }
  for (const [index, release] of signedReleases.entries()) {
    await ctx.db.insert("tryoutBundles", {
      createdAt: NOW,
      index,
      manifestHash: release.manifestHash,
      releaseId: release.manifest.releaseId,
      releaseJson: JSON.stringify(release),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
      snapshotId,
    });
  }
  const first = await insertRetainedAttempt(ctx, {
    frozenContentHash: "f".repeat(64),
    frozenSourcePath: firstPlacement.questionSourcePath.replace(
      "packages/corpus/",
      ""
    ),
    placement: firstPlacement,
    releaseId: firstRelease.manifest.releaseId,
    snapshotId,
    suffix: "en",
  });
  const second = await insertRetainedAttempt(ctx, {
    placement: secondPlacement,
    releaseId: secondRelease.manifest.releaseId,
    snapshotId,
    suffix: "id",
  });
  for (const attemptId of [first.attemptId, second.attemptId]) {
    const attempt = await ctx.db.get("tryoutAttempts", attemptId);
    if (!attempt) {
      throw new Error("Expected retained attempt fixture.");
    }
    await ctx.db.insert("tryoutSetProgress", {
      appLocale: attempt.locale,
      attemptNumber: attempt.attemptNumber,
      countryKey: attempt.countryKey,
      examKey: attempt.examKey,
      latestAttemptId: attempt._id,
      locale: attempt.locale,
      publishedScore: null,
      setIdentity: attempt.setIdentity,
      setKey: attempt.setKey,
      status: attempt.status,
      statusRank: 1,
      trackKey: attempt.trackKey,
      updatedAt: NOW,
      userId: attempt.userId,
    });
  }
  for (const artifacts of signedArtifacts) {
    for (const artifact of [artifacts.question, artifacts.answer]) {
      await ctx.db.insert("contentArtifacts", {
        artifactHash: artifact.artifactHash,
        artifactJson: JSON.stringify(artifact),
        createdAt: NOW,
        retainUntil: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const [catalogRows, placementRows] = await Promise.all([
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId)
      )
      .collect(),
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId)
      )
      .collect(),
  ]);
  for (const row of catalogRows) {
    await ctx.db.insert("tryoutHistoryRows", {
      index: row.index,
      rowHash: row.rowHash,
      rowJson: row.rowJson,
      rowKind: "catalog",
      snapshotId: row.snapshotId,
    });
  }
  for (const row of placementRows) {
    await ctx.db.insert("tryoutHistoryRows", {
      answerArtifactHash: row.answerArtifactHash,
      index: row.index,
      questionArtifactHash: row.questionArtifactHash,
      rowHash: row.rowHash,
      rowJson: row.rowJson,
      rowKind: "placement",
      snapshotId: row.snapshotId,
    });
  }
  await ctx.db.insert("tryoutAttemptHistory", {
    snapshotReleaseId: firstRelease.manifest.releaseId,
    tryoutAttemptId: first.attemptId,
    tryoutSnapshotId: snapshotId,
  });
  await ctx.db.insert("tryoutAttemptHistory", {
    snapshotReleaseId: secondRelease.manifest.releaseId,
    tryoutAttemptId: second.attemptId,
    tryoutSnapshotId: snapshotId,
  });

  const plan = {
    artifactCount: 4,
    attemptCount: 2,
    catalogRowCount: 2,
    firstCatalogIndex: 0,
    firstPlacementIndex: 2,
    format: "tryout-v1",
    frozenPlacementCount: 2,
    placementRowCount: 2,
    progressCount: 2,
    releases: signedReleases.map((release) => ({
      attemptCount: 1,
      manifestHash: release.manifestHash,
      releaseId: release.manifest.releaseId,
    })),
    snapshotId,
  } satisfies RetainedTryoutHistoryPlan;
  return { attemptIds: [first.attemptId, second.attemptId], plan };
}

export function fixtureAttemptId(
  fixture: Awaited<ReturnType<typeof seedRetainedTryoutHistory>>,
  index: number
): Id<"tryoutAttempts"> {
  const attemptId = fixture.attemptIds[index];
  if (!attemptId) {
    throw new Error(`Expected retained attempt fixture ${index}.`);
  }
  return attemptId;
}
