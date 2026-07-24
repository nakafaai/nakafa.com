import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Schema } from "effect";

export const liveIrtCounts = {
  items: 600,
  runs: 28,
  scales: 4,
} as const;

const artifactHash = Sha256HashSchema.make(`sha256:${"6".repeat(64)}`);
const runsPerScale = liveIrtCounts.runs / liveIrtCounts.scales;

/** Returns the exact observed item count assigned to one calibration run. */
function runItemCount(runIndex: number) {
  return runIndex < 12 ? 22 : 21;
}

/** Returns the exact observed item count assigned to one scale. */
function scaleItemCount(scaleIndex: number) {
  const firstRun = scaleIndex * runsPerScale;
  return Array.from({ length: runsPerScale }, (_, offset) =>
    runItemCount(firstRun + offset)
  ).reduce((sum, count) => sum + count, 0);
}

/** Builds one contract-valid technical learning graph identity. */
function graphIdentity(kind: "section" | "set", index: number) {
  return {
    alignmentId: `alignment:tryout:irt:${kind}:${index}`,
    assetId: `asset:id:tryout:irt:${kind}:${index}`,
    conceptId: `concept:tryout:irt:${kind}:${index}`,
    learningObjectId: `lo:tryout-irt-${kind}-${index}`,
    lensId: "lens:tryout:irt",
  };
}

/** Decodes one technical catalog row through the production contract. */
function decodeCatalog(input: unknown): TryoutCatalogRow {
  return Schema.decodeUnknownSync(TryoutCatalogRowSchema)(input);
}

/** Decodes one technical placement through the production contract. */
function decodePlacement(input: unknown): TryoutPlacement {
  return Schema.decodeUnknownSync(TryoutPlacementSchema)(input);
}

/** Builds the exact 4-scale, 28-run, 600-item signed snapshot rows. */
function makeLiveSnapshotRows() {
  const catalog: TryoutCatalogRow[] = [];
  const placements: TryoutPlacement[] = [];
  for (let scaleIndex = 0; scaleIndex < liveIrtCounts.scales; scaleIndex += 1) {
    const setKey = `set-${scaleIndex + 1}`;
    catalog.push(
      decodeCatalog({
        countryKey: "indonesia",
        examKey: "snbt",
        graph: graphIdentity("set", scaleIndex),
        kind: "set",
        locale: "id",
        order: scaleIndex + 1,
        publicPath: `try-out/indonesia/snbt/2027/${setKey}`,
        questionCount: scaleItemCount(scaleIndex),
        scoringStrategy: "irt",
        sectionCount: runsPerScale,
        setKey,
        sourceRevision: "2026",
        title: `Technical set ${scaleIndex + 1}`,
        trackKey: "2027",
        visibleSectionCount: runsPerScale,
      })
    );
  }
  for (let runIndex = 0; runIndex < liveIrtCounts.runs; runIndex += 1) {
    const scaleIndex = Math.floor(runIndex / runsPerScale);
    const setKey = `set-${scaleIndex + 1}`;
    const sectionKey = `section-${runIndex + 1}`;
    const sourcePath = `question-bank/tryout/indonesia/snbt/2027/${setKey}/${sectionKey}`;
    const questionCount = runItemCount(runIndex);
    catalog.push(
      decodeCatalog({
        countryKey: "indonesia",
        examKey: "snbt",
        graph: graphIdentity("section", runIndex),
        kind: "section",
        locale: "id",
        order: (runIndex % runsPerScale) + 1,
        publicPath: `try-out/indonesia/snbt/2027/${setKey}/${sectionKey}`,
        questionCount,
        questionSourcePath: `packages/corpus/${sourcePath}`,
        sectionKey,
        setKey,
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        title: `Technical section ${runIndex + 1}`,
        trackKey: "2027",
        visibility: "visible",
      })
    );
    for (
      let questionOrder = 1;
      questionOrder <= questionCount;
      questionOrder += 1
    ) {
      const questionPath = `${sourcePath}/question-${questionOrder}`;
      placements.push(
        decodePlacement({
          answerArtifactHash: artifactHash,
          answerContentKey: `${questionPath}/answer`,
          choices: [
            {
              isCorrect: true,
              label: "Technical choice",
              optionKey: "option-1",
              order: 1,
            },
          ],
          countryKey: "indonesia",
          examKey: "snbt",
          locale: "id",
          questionArtifactHash: artifactHash,
          questionContentKey: `${questionPath}/question`,
          questionOrder,
          questionSourcePath: `packages/corpus/${questionPath}`,
          rendererDomain: "snbt-math",
          scope: "server",
          sectionKey,
          setKey,
          sourceRevision: "2026",
          title: `Technical question ${questionOrder}`,
          trackKey: "2027",
        })
      );
    }
  }
  return { catalog, placements };
}

/** Inserts one exact legacy calibration run and all of its scale items. */
async function insertRun(
  ctx: MutationCtx,
  runIndex: number,
  scaleVersionId: Id<"irtScaleVersions">,
  tryoutSetId: Id<"tryoutSets">
) {
  const scaleIndex = Math.floor(runIndex / runsPerScale);
  const setKey = `set-${scaleIndex + 1}`;
  const sectionKey = `section-${runIndex + 1}`;
  const sourcePath = `question-bank/tryout/indonesia/snbt/2027/${setKey}/${sectionKey}`;
  const questionCount = runItemCount(runIndex);
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    questionCount,
    sectionKey,
    setKey,
    sourcePath,
    withQuestion: false,
  });
  const tryoutSectionId = await insertTryoutSection(ctx, {
    order: (runIndex % runsPerScale) + 1,
    publicPath: `try-out/indonesia/snbt/2027/${setKey}/${sectionKey}`,
    questionCount,
    questionSetId,
    questionSourcePath: sourcePath,
    sectionKey,
    setKey,
    tryoutSetId,
  });
  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 0,
    completedAt: TRYOUT_TEST_NOW,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount,
    responseCount: 0,
    startedAt: TRYOUT_TEST_NOW,
    status: "completed",
    tryoutSectionId,
    updatedAt: TRYOUT_TEST_NOW,
  });
  for (
    let questionOrder = 1;
    questionOrder <= questionCount;
    questionOrder += 1
  ) {
    const questionPath = `${sourcePath}/question-${questionOrder}`;
    const contentHash = `${questionPath}:hash`;
    const questionId = await ctx.db.insert("questions", {
      answerBody: "Technical answer",
      contentHash,
      date: 0,
      locale: "id",
      number: questionOrder,
      questionBody: "Technical question",
      questionSetId,
      sourceKey: `${questionPath}:source`,
      sourcePath: questionPath,
      sourceRevision: "2026",
      syncedAt: TRYOUT_TEST_NOW,
      title: `Technical question ${questionOrder}`,
    });
    await ctx.db.insert("irtScaleItems", {
      calibrationRunId,
      calibrationStatus: "provisional",
      contentHash,
      correctRate: 0,
      difficulty: 0,
      discrimination: 1,
      questionId,
      questionSourceKey: `${questionPath}:source`,
      responseCount: 0,
      scaleVersionId,
      sourceRevision: "2026",
    });
  }
}

/** Seeds the observed 4/28/600 IRT graph against one signed snapshot. */
export async function seedLiveIrtMigration(ctx: MutationCtx) {
  const rows = makeLiveSnapshotRows();
  const snapshotId = await activateTryoutSnapshot(ctx, rows);
  for (let scaleIndex = 0; scaleIndex < liveIrtCounts.scales; scaleIndex += 1) {
    const setKey = `set-${scaleIndex + 1}`;
    const questionCount = scaleItemCount(scaleIndex);
    const tryoutSetId = await insertTryoutSet(ctx, {
      order: scaleIndex + 1,
      publicPath: `try-out/indonesia/snbt/2027/${setKey}`,
      sectionCount: runsPerScale,
      setKey,
      title: `Technical set ${scaleIndex + 1}`,
      totalQuestionCount: questionCount,
      visibleSectionCount: runsPerScale,
    });
    const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
      model: "2pl",
      publishedAt: TRYOUT_TEST_NOW,
      questionCount,
      status: "provisional",
      tryoutSetId,
    });
    for (let offset = 0; offset < runsPerScale; offset += 1) {
      await insertRun(
        ctx,
        scaleIndex * runsPerScale + offset,
        scaleVersionId,
        tryoutSetId
      );
    }
  }
  return snapshotId;
}
