import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  getLearningPreferenceByUserId,
  upsertPreferredCurriculumProgram,
} from "@repo/backend/convex/learningPreferences/impl";
import {
  listSignedPrograms,
  readSignedProgram,
} from "@repo/backend/convex/learningPrograms/selection";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { Clock, Effect, Schema } from "effect";

const CURRICULUM_PROGRAM_LIMIT = 50;
const curriculumPreferenceIoFailedCode = "CURRICULUM_PREFERENCE_IO_FAILED";
const curriculumProgramNotFoundCode = "CURRICULUM_PROGRAM_NOT_FOUND";

/** Expected curriculum preference failure exposed through Convex errors. */
export class CurriculumPreferenceError extends Schema.TaggedError<CurriculumPreferenceError>()(
  "CurriculumPreferenceError",
  {
    code: Schema.Literal(
      curriculumPreferenceIoFailedCode,
      curriculumProgramNotFoundCode
    ),
    message: Schema.String,
  }
) {}

/** Compact curriculum option consumed by selectors and preference storage. */
export interface CurriculumProgramOption {
  readonly countryCode?: string;
  readonly key: string;
  readonly publicSlug: string;
  readonly title: string;
}

/** Maps unknown database failures into the curriculum preference error channel. */
function toPreferenceIoError(error: unknown) {
  return new CurriculumPreferenceError({
    code: curriculumPreferenceIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Converts one verified Aksara program into a localized selector option. */
const toCurriculumProgramOption = Effect.fn(
  "learningPreferences.toCurriculumProgramOption"
)(function* (program: LearningProgram, locale: Locale) {
  const translation = program.translations.find(
    (candidate) => candidate.appLocale === locale
  );
  if (!translation) {
    return yield* new CurriculumPreferenceError({
      code: curriculumPreferenceIoFailedCode,
      message: `Curriculum program ${program.key} has no ${locale} translation.`,
    });
  }

  return {
    ...(program.provider.homeCountry
      ? { countryCode: program.provider.homeCountry }
      : {}),
    key: program.key,
    publicSlug: translation.publicSlug,
    title: translation.title,
  } satisfies CurriculumProgramOption;
});

/** Reads one localized school curriculum from the signed active snapshot. */
export const readCurriculumProgram = Effect.fn(
  "learningPreferences.readCurriculumProgram"
)(function* (ctx: QueryCtx | MutationCtx, locale: Locale, programKey: string) {
  const program = yield* readSignedProgram(ctx, locale, programKey);

  if (program?.kind !== "school-curriculum") {
    return null;
  }

  return yield* toCurriculumProgramOption(program, locale);
});

/** Lists every school curriculum from the signed active snapshot. */
export const listCurriculumPrograms = Effect.fn(
  "learningPreferences.listCurriculumPrograms"
)(function* (ctx: QueryCtx, locale: Locale) {
  const programs = yield* listSignedPrograms(ctx, locale);
  const curricula = programs.filter(
    (program) => program.kind === "school-curriculum"
  );

  if (curricula.length > CURRICULUM_PROGRAM_LIMIT) {
    return yield* new CurriculumPreferenceError({
      code: curriculumPreferenceIoFailedCode,
      message: `Curriculum program catalog exceeds ${CURRICULUM_PROGRAM_LIMIT} rows.`,
    });
  }

  return yield* Effect.forEach(curricula, (program) =>
    toCurriculumProgramOption(program, locale)
  );
});

/** Resolves the learner's explicit preference against the signed catalog. */
export const readCurrentCurriculumProgram = Effect.fn(
  "learningPreferences.readCurrentCurriculumProgram"
)(function* (ctx: QueryCtx, locale: Locale, userId: Id<"users">) {
  const preference = yield* Effect.tryPromise({
    catch: toPreferenceIoError,
    try: () => getLearningPreferenceByUserId(ctx, userId),
  });

  if (!preference?.preferredCurriculumProgramKey) {
    return null;
  }

  const program = yield* readCurriculumProgram(
    ctx,
    locale,
    preference.preferredCurriculumProgramKey
  );

  if (!program) {
    return null;
  }

  return {
    preferredCurriculumProgramKey: preference.preferredCurriculumProgramKey,
    program,
  };
});

/** Saves one verified curriculum preference under signed Aksara ownership. */
export const saveCurriculumProgram = Effect.fn(
  "learningPreferences.saveCurriculumProgram"
)(function* (
  ctx: MutationCtx,
  locale: Locale,
  programKey: string,
  userId: Id<"users">
) {
  const program = yield* readCurriculumProgram(ctx, locale, programKey);

  if (!program) {
    return yield* new CurriculumPreferenceError({
      code: curriculumProgramNotFoundCode,
      message: "Curriculum program not found.",
    });
  }

  const now = yield* Clock.currentTimeMillis;
  yield* Effect.tryPromise({
    catch: toPreferenceIoError,
    try: () =>
      upsertPreferredCurriculumProgram({
        ctx,
        now,
        programKey: program.key,
        userId,
      }),
  });

  return {
    preferredCurriculumProgramKey: program.key,
    program,
  };
});
