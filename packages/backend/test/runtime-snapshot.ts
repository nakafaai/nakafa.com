import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  TryoutCatalogRowSchema,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import { insertTryoutQuestionSource } from "@repo/backend/test/tryouts";
import { ConvexError } from "convex/values";
import { Schema } from "effect";

const artifactHash = Sha256HashSchema.make(`sha256:${"6".repeat(64)}`);

/** One section source used to build a signed runtime test snapshot. */
export interface RuntimeSnapshotSection {
  readonly order: number;
  readonly publicPath: string;
  readonly sectionKey: string;
  readonly sourcePath: string;
}

/** Inserts one exact question and choice source used by runtime snapshot tests. */
export async function insertRuntimeSectionSource(
  ctx: MutationCtx,
  sectionKey: string
) {
  const sourcePath = `question-bank/tryout/indonesia/snbt/2027/set-1/${sectionKey}`;
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    sectionKey,
    sourcePath,
  });
  const question = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (query) =>
      query.eq("questionSetId", questionSetId).eq("number", 1)
    )
    .unique();

  if (!question) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_NOT_FOUND",
      message: "Expected try-out question fixture.",
    });
  }

  await ctx.db.insert("questionChoices", {
    isCorrect: true,
    label: "A",
    locale: "id",
    optionKey: "option-1",
    order: 1,
    questionId: question._id,
  });

  return { questionId: question._id, questionSetId, sourcePath };
}

/** Activates one exact signed snapshot for attempt finalization fixtures. */
export function activateRuntimeSnapshot(
  ctx: MutationCtx,
  sections: readonly RuntimeSnapshotSection[]
) {
  const graph = {
    alignmentId: "alignment:tryout:runtime",
    assetId: "asset:id:tryout:runtime",
    conceptId: "concept:tryout:runtime",
    learningObjectId: "lo:tryout-runtime",
    lensId: "lens:tryout:runtime",
  };
  const set = Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    examKey: "snbt",
    graph,
    kind: "set",
    locale: "id",
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027/set-1",
    questionCount: sections.length,
    scoringStrategy: "irt",
    sectionCount: sections.length,
    setKey: "set-1",
    sourceRevision: "2026",
    title: "Set 1",
    trackKey: "2027",
    visibleSectionCount: sections.length,
  });
  const catalog = [
    set,
    ...sections.map((section) =>
      Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
        countryKey: "indonesia",
        examKey: "snbt",
        graph: {
          ...graph,
          assetId: `asset:id:tryout:runtime:${section.sectionKey}`,
          learningObjectId: `lo:tryout-runtime-${section.sectionKey}`,
        },
        kind: "section",
        locale: "id",
        order: section.order,
        publicPath: section.publicPath,
        questionCount: 1,
        questionSourcePath: `packages/corpus/${section.sourcePath}`,
        sectionKey: section.sectionKey,
        setKey: "set-1",
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        trackKey: "2027",
        visibility: "visible",
      })
    ),
  ];
  const placements = sections.map((section) =>
    Schema.decodeUnknownSync(TryoutPlacementSchema)({
      answerArtifactHash: artifactHash,
      answerContentKey: `${section.sourcePath}/question-1/answer`,
      choices: [
        {
          isCorrect: true,
          label: "A",
          optionKey: "option-1",
          order: 1,
        },
      ],
      countryKey: "indonesia",
      examKey: "snbt",
      locale: "id",
      questionArtifactHash: artifactHash,
      questionContentKey: `${section.sourcePath}/question-1/question`,
      questionOrder: 1,
      questionSourcePath: `packages/corpus/${section.sourcePath}/question-1`,
      rendererDomain: "snbt-math",
      scope: "server",
      sectionKey: section.sectionKey,
      setKey: "set-1",
      sourceRevision: "2026",
      title: "Question",
      trackKey: "2027",
    })
  );
  return activateTryoutSnapshot(ctx, { catalog, placements });
}
