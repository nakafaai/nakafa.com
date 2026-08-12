import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readVerifiedProgramCatalog } from "@repo/backend/convex/contentRelease/program/catalog";
import {
  type learningProgramSummaryValidator,
  programMatchesInterest,
} from "@repo/backend/convex/learningPrograms/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { LearningInterest } from "@repo/contents/_types/program/schema";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

type ProgramCtx = MutationCtx | QueryCtx;
type LearningProgramSummary = Infer<typeof learningProgramSummaryValidator>;

const programInterestMismatchCode = "LEARNING_PROGRAM_INTEREST_MISMATCH";
const programNotFoundCode = "LEARNING_PROGRAM_NOT_FOUND";
const programNotSelectableCode = "LEARNING_PROGRAM_NOT_SELECTABLE";

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

/** Reads one authenticated program by its stable Aksara key. */
export const readSignedProgram = Effect.fn(
  "learningPrograms.readSignedProgram"
)(function* (ctx: ProgramCtx, locale: Locale, programKey: string) {
  const programs = yield* listSignedPrograms(ctx, locale);
  return programs.find((program) => program.key === programKey) ?? null;
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
  const catalog = yield* readVerifiedProgramCatalog(ctx, locale);

  if (!catalog.managed) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "Active signed program catalog is unavailable."
    );
  }

  return catalog.programs;
});
