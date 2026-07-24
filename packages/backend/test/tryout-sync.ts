import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
  type TryoutPlacement,
  TryoutPlacementSchema,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { BulkSyncTryoutsArgs } from "@repo/backend/convex/contentSync/tryouts/impl";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import { Schema } from "effect";

const artifactHash = Sha256HashSchema.make(`sha256:${"9".repeat(64)}`);

/** Activates the exact signed snapshot matching one IRT sync test payload. */
export function activateIrtSyncSnapshot(
  ctx: MutationCtx,
  payload: BulkSyncTryoutsArgs
) {
  const set = requireOne(payload.sets, "set");
  const section = requireOne(payload.sections, "section");
  const questions = payload.questions
    .filter(
      (question) =>
        question.locale === section.locale &&
        question.questionSetSourcePath === section.questionSourcePath
    )
    .sort((left, right) => left.number - right.number);
  if (questions.length !== section.questionCount) {
    throw new Error("Expected one complete technical IRT question set.");
  }
  const catalog = [
    decodeCatalog({
      countryKey: set.countryKey,
      examKey: set.examKey,
      graph: graphIdentity("set"),
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
    }),
    decodeCatalog({
      countryKey: section.countryKey,
      examKey: section.examKey,
      graph: graphIdentity("section"),
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
    }),
  ];
  const placements = questions.map((question) =>
    decodePlacement({
      answerArtifactHash: artifactHash,
      answerContentKey: `${question.sourcePath}/answer`,
      choices: question.choices,
      countryKey: section.countryKey,
      examKey: section.examKey,
      locale: question.locale,
      questionArtifactHash: artifactHash,
      questionContentKey: `${question.sourcePath}/question`,
      questionOrder: question.number,
      questionSourcePath: `packages/corpus/${question.sourcePath}`,
      rendererDomain: "snbt-math",
      scope: "server",
      sectionKey: section.sectionKey,
      setKey: section.setKey,
      sourceRevision: question.sourceRevision,
      title: question.title,
      trackKey: section.trackKey,
    })
  );
  return activateTryoutSnapshot(ctx, { catalog, placements });
}

/** Decodes one technical catalog row through the production contract. */
function decodeCatalog(input: unknown): TryoutCatalogRow {
  return Schema.decodeUnknownSync(TryoutCatalogRowSchema)(input);
}

/** Decodes one technical placement through the production contract. */
function decodePlacement(input: unknown): TryoutPlacement {
  return Schema.decodeUnknownSync(TryoutPlacementSchema)(input);
}

/** Returns one required technical fixture row without unsafe assertions. */
function requireOne<A>(values: readonly A[], label: string) {
  const value = values.at(0);
  if (values.length !== 1 || value === undefined) {
    throw new Error(`Expected exactly one technical ${label}.`);
  }
  return value;
}

/** Builds a strict learning-graph identity for one technical row kind. */
function graphIdentity(kind: "section" | "set") {
  return {
    alignmentId: `alignment:tryout:sync:${kind}`,
    assetId: `asset:id:tryout:sync:${kind}`,
    conceptId: `concept:tryout:sync:${kind}`,
    learningObjectId: `lo:tryout-sync-${kind}`,
    lensId: "lens:tryout:sync",
  };
}
