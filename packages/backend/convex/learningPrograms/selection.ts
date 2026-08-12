import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PROGRAM_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyProgram } from "@repo/backend/convex/contentRelease/program/verify";
import {
  type learningProgramSummaryValidator,
  programMatchesInterest,
} from "@repo/backend/convex/learningPrograms/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { LearningInterest } from "@repo/contents/_types/program/schema";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type ProgramCtx = MutationCtx | QueryCtx;
type LearningProgramSummary = Infer<typeof learningProgramSummaryValidator>;

const programCatalogIoFailedCode = "LEARNING_PROGRAM_CATALOG_IO_FAILED";
const programInterestMismatchCode = "LEARNING_PROGRAM_INTEREST_MISMATCH";
const programNotFoundCode = "LEARNING_PROGRAM_NOT_FOUND";
const programNotSelectableCode = "LEARNING_PROGRAM_NOT_SELECTABLE";

/** Expected database failure while reading the signed program catalog. */
export class LearningProgramCatalogError extends Schema.TaggedError<LearningProgramCatalogError>()(
  "LearningProgramCatalogError",
  {
    code: Schema.Literal(programCatalogIoFailedCode),
    message: Schema.String,
  }
) {}

/** Expected rejection of one invalid learner program selection. */
export class LearningProgramSelectionError extends Schema.TaggedError<LearningProgramSelectionError>()(
  "LearningProgramSelectionError",
  {
    code: Schema.Literal(
      programInterestMismatchCode,
      programNotFoundCode,
      programNotSelectableCode
    ),
    message: Schema.String,
  }
) {}

/** Maps unknown database failures into the program catalog error channel. */
function toProgramCatalogError(error: unknown) {
  return new LearningProgramCatalogError({
    code: programCatalogIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Checks whether a signed program is ready for learner selection. */
export function isLearningProgramSelectable(program: LearningProgram) {
  return (
    program.defaultCoverageStatus === "available" ||
    program.defaultCoverageStatus === "partial"
  );
}

/** Returns the localized public summary for one authenticated program row. */
export function toLearningProgramSummary(
  program: LearningProgram,
  locale: Locale
): LearningProgramSummary {
  const translation = program.translations[locale];

  return {
    coverageStatus: program.defaultCoverageStatus,
    displayOrder: program.displayOrder,
    key: program.key,
    kind: program.kind,
    navigation: {
      levels: [...program.navigation.levels],
      model: program.navigation.model,
    },
    publicSlug: translation.publicSlug,
    title: translation.title,
    versionLabel: program.version.label,
  };
}

/** Requires the active release to own one verified program snapshot. */
const requireProgramSnapshot = Effect.fn(
  "learningPrograms.requireProgramSnapshot"
)(function* (ctx: ProgramCtx, locale: Locale) {
  const owner = yield* loadProgramOwner(ctx, locale);

  if (!(owner.managed && owner.selected)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "Active signed program catalog is unavailable."
    );
  }

  return owner.selected.snapshotId;
});

/** Reads one authenticated program by its stable Aksara key. */
export const readSignedProgram = Effect.fn(
  "learningPrograms.readSignedProgram"
)(function* (ctx: ProgramCtx, locale: Locale, programKey: string) {
  const snapshotId = yield* requireProgramSnapshot(ctx, locale);
  const row = yield* Effect.tryPromise({
    catch: toProgramCatalogError,
    try: () =>
      ctx.db
        .query("programCatalog")
        .withIndex("by_snapshotId_and_programKey", (index) =>
          index.eq("snapshotId", snapshotId).eq("programKey", programKey)
        )
        .unique(),
  });

  if (!row) {
    return null;
  }

  return yield* verifyProgram(row, snapshotId);
});

/** Requires one signed program to be selectable for the learner's interest. */
export const requireSelectableProgram = Effect.fn(
  "learningPrograms.requireSelectableProgram"
)(function* (
  ctx: ProgramCtx,
  locale: Locale,
  programKey: string,
  interest: LearningInterest
) {
  const program = yield* readSignedProgram(ctx, locale, programKey);

  if (!program) {
    return yield* new LearningProgramSelectionError({
      code: programNotFoundCode,
      message: "Learning program not found.",
    });
  }

  if (!isLearningProgramSelectable(program)) {
    return yield* new LearningProgramSelectionError({
      code: programNotSelectableCode,
      message: "Learning program is not selectable.",
    });
  }

  if (!programMatchesInterest(program.kind, interest)) {
    return yield* new LearningProgramSelectionError({
      code: programInterestMismatchCode,
      message: "Selected program does not match the selected interest.",
    });
  }

  return program;
});

/** Reads the complete bounded program catalog from the signed active snapshot. */
export const listSignedPrograms = Effect.fn(
  "learningPrograms.listSignedPrograms"
)(function* (ctx: ProgramCtx, locale: Locale) {
  const snapshotId = yield* requireProgramSnapshot(ctx, locale);
  const rows = yield* Effect.tryPromise({
    catch: toProgramCatalogError,
    try: () =>
      ctx.db
        .query("programCatalog")
        .withIndex("by_snapshotId_and_displayOrder_and_programKey", (index) =>
          index.eq("snapshotId", snapshotId)
        )
        .take(PROGRAM_CATALOG_LIMIT + 1),
  });

  if (rows.length > PROGRAM_CATALOG_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program catalog exceeds ${PROGRAM_CATALOG_LIMIT} rows.`
    );
  }

  return yield* Effect.forEach(rows, (row) => verifyProgram(row, snapshotId));
});
