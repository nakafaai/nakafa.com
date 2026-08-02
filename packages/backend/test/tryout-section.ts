import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  makeTryoutCatalogRecord,
  makeTryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/row-hash";
import {
  TryoutContentHashSchema,
  type TryoutPlacement,
  TryoutPlacementSchema,
  TryoutSectionSchema,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  SignedTryoutSource,
  TryoutStartSource,
} from "@repo/backend/convex/tryouts/start/source";
import { testTextHash } from "@repo/backend/test/content-release";
import { insertTryoutQuestionSource } from "@repo/backend/test/tryouts";
import { ConvexError } from "convex/values";
import { Schema } from "effect";

export const TRYOUT_TEST_CONTENT_HASH = TryoutContentHashSchema.make(
  "3".repeat(64)
);

/** Test-owned pair used to compare one filesystem section with signed rows. */
export interface AlignedTryoutSectionFixture {
  readonly filesystem: Doc<"tryoutSections">;
  readonly signed: SignedTryoutSource["snapshot"]["sections"][number];
}

/** Builds one signed section source that matches a legacy runtime fixture. */
export function makeAlignedTryoutSection(
  section: Doc<"tryoutSections">,
  options: {
    readonly contentHash?: TryoutPlacement["contentHash"];
    readonly sourceRevision?: TryoutPlacement["sourceRevision"];
  } = {}
): AlignedTryoutSectionFixture {
  const sourceRevision = options.sourceRevision ?? section.sourceRevision;
  const questionRoot = `${section.questionSourcePath}/question-1`;
  const signedSection = Schema.decodeUnknownSync(TryoutSectionSchema)({
    countryKey: section.countryKey,
    examKey: section.examKey,
    graph: makeTryoutGraph(section.sectionKey),
    kind: "section",
    locale: section.locale,
    order: section.order,
    publicPath: section.publicPath,
    questionCount: section.questionCount,
    questionSourcePath: `packages/corpus/${section.questionSourcePath}`,
    sectionKey: section.sectionKey,
    setKey: section.setKey,
    sourceRevision: section.sourceRevision,
    timeLimitSeconds: section.timeLimitSeconds,
    title: section.title,
    trackKey: section.trackKey,
    visibility: section.visibility,
  });
  const placement = Schema.decodeUnknownSync(TryoutPlacementSchema)({
    answerArtifactHash: testTextHash(`${questionRoot}:answer`),
    answerContentKey: `${questionRoot}/answer`,
    choices: [
      {
        isCorrect: true,
        label: "A",
        optionKey: "option-1",
        order: 1,
      },
    ],
    contentHash: options.contentHash ?? TRYOUT_TEST_CONTENT_HASH,
    countryKey: section.countryKey,
    examKey: section.examKey,
    locale: section.locale,
    questionArtifactHash: testTextHash(`${questionRoot}:question`),
    questionContentKey: `${questionRoot}/question`,
    questionOrder: 1,
    questionSourcePath: `packages/corpus/${questionRoot}`,
    rendererDomain: "snbt-math",
    scope: "server",
    sectionKey: section.sectionKey,
    setKey: section.setKey,
    sourceRevision,
    title: "Question",
    trackKey: section.trackKey,
  });
  const { row, rowHash } = makeTryoutCatalogRecord(signedSection);
  if (row.kind !== "section") {
    throw new Error("Expected one signed section record.");
  }

  return {
    filesystem: section,
    signed: {
      placements: [makeTryoutPlacementRecord(placement)],
      section: { row, rowHash },
      snapshotId: testTextHash("tryout-runtime-snapshot"),
    },
  };
}

/** Builds one complete signed source without retaining filesystem identifiers. */
export function makeSignedTryoutSource(
  set: Doc<"tryoutSets">,
  sections: readonly AlignedTryoutSectionFixture[],
  snapshotId = testTextHash("tryout-runtime-snapshot")
): Extract<TryoutStartSource, { kind: "signed" }> {
  const signedSet = Schema.decodeUnknownSync(TryoutSetSchema)({
    countryKey: set.countryKey,
    examKey: set.examKey,
    graph: makeTryoutGraph(set.setKey),
    internalEntrySectionKey: set.internalEntrySectionKey,
    kind: "set",
    locale: set.locale,
    order: set.order,
    publicPath: set.publicPath,
    questionCount: set.totalQuestionCount,
    scoringStrategy: set.scoringStrategy,
    sectionCount: set.sectionCount,
    setKey: set.setKey,
    sourceRevision: set.sourceRevision,
    title: set.title,
    trackKey: set.trackKey,
    visibleSectionCount: set.visibleSectionCount,
  });
  const record = makeTryoutCatalogRecord(signedSet);
  if (record.row.kind !== "set") {
    throw new Error("Expected one signed set record.");
  }
  const setRecord = { row: record.row, rowHash: record.rowHash };

  return {
    kind: "signed",
    snapshot: {
      sections: sections.map(({ signed }) => signed),
      set: setRecord,
      setIdentity: tryoutCatalogIdentity(setRecord.row),
      snapshotId,
    },
  };
}

/** Inserts one legacy section source with the selectable answer fixture. */
export async function insertTryoutSectionSource(
  ctx: MutationCtx,
  sectionKey: string
) {
  const sourcePath = `question-bank/tryout/indonesia/snbt/${sectionKey}/set-1`;
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    contentHash: TRYOUT_TEST_CONTENT_HASH,
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

  return {
    contentHash: TryoutContentHashSchema.make(question.contentHash),
    questionId: question._id,
    questionSetId,
    sourcePath,
  };
}

/** Builds a stable graph identity for one signed runtime fixture. */
function makeTryoutGraph(sectionKey: string) {
  return {
    alignmentId: `alignment:tryout:runtime:${sectionKey}`,
    assetId: `asset:id:tryout:runtime:${sectionKey}`,
    conceptId: `concept:tryout:runtime:${sectionKey}`,
    learningObjectId: `lo:tryout-runtime-${sectionKey}`,
    lensId: "lens:tryout:runtime",
  };
}
