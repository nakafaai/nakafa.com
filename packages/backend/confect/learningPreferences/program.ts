import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  readLearningPreferenceByUserId,
  setPreferredCurriculumProgram,
} from "@repo/backend/confect/learningPreferences/impl";
import {
  CurriculumPreferenceError,
  curriculumPreferenceIoFailedCode,
  curriculumProgramNotFoundCode,
} from "@repo/backend/confect/learningPreferences/schema";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { readVerifiedProgramCatalog } from "@repo/backend/content/program/catalog";
import { programLayer } from "@repo/backend/content/program/confect";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Clock, Effect } from "effect";

const CURRICULUM_PROGRAM_LIMIT = 50;
const curriculumPreferenceIoFailedMessage =
  "Unable to read or persist curriculum preferences.";
/** Compact curriculum option consumed by selectors and preference storage. */
export interface CurriculumProgramOption {
  readonly countryCode?: string;
  readonly key: string;
  readonly publicSlug: string;
  readonly title: string;
}
/** Maps unknown database failures into the curriculum preference error channel. */
function toPreferenceIoError() {
  return new CurriculumPreferenceError({
    code: curriculumPreferenceIoFailedCode,
    message: curriculumPreferenceIoFailedMessage,
  });
}
/** Reads the complete program catalog from the signed active snapshot. */
const listSignedPrograms = Effect.fn("learningPreferences.listSignedPrograms")(
  function* (locale: Locale) {
    const catalog = yield* readVerifiedProgramCatalog(locale).pipe(
      Effect.provide(programLayer)
    );
    if (!catalog.managed) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        "Active signed program catalog is unavailable."
      );
    }
    return catalog.programs;
  }
);
/** Reads one signed program by its stable Aksara key. */
const readSignedProgram = Effect.fn("learningPreferences.readSignedProgram")(
  function* (locale: Locale, programKey: string) {
    const programs = yield* listSignedPrograms(locale);
    return programs.find((program) => program.key === programKey) ?? null;
  }
);
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
      ? {
          countryCode: program.provider.homeCountry,
        }
      : {}),
    key: program.key,
    publicSlug: translation.publicSlug,
    title: translation.title,
  } satisfies CurriculumProgramOption;
});
/** Reads one localized school curriculum from the signed active snapshot. */
export const readCurriculumProgram = Effect.fn(
  "learningPreferences.readCurriculumProgram"
)(function* (locale: Locale, programKey: string) {
  const program = yield* readSignedProgram(locale, programKey);
  if (program?.kind !== "school-curriculum") {
    return null;
  }
  return yield* toCurriculumProgramOption(program, locale);
});
/** Lists every school curriculum from the signed active snapshot. */
export const listCurriculumPrograms = Effect.fn(
  "learningPreferences.listCurriculumPrograms"
)(function* (locale: Locale) {
  const programs = yield* listSignedPrograms(locale);
  const curricula = Arr.filter(
    programs,
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
)(function* (locale: Locale, userId: Id<"users">) {
  const preference = yield* readLearningPreferenceByUserId(userId).pipe(
    Effect.mapError(toPreferenceIoError)
  );
  if (!preference?.preferredCurriculumProgramKey) {
    return null;
  }
  const program = yield* readCurriculumProgram(
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
)(function* (locale: Locale, programKey: string, userId: Id<"users">) {
  const program = yield* readCurriculumProgram(locale, programKey);
  if (!program) {
    return yield* new CurriculumPreferenceError({
      code: curriculumProgramNotFoundCode,
      message: "Curriculum program not found.",
    });
  }
  const now = yield* Clock.currentTimeMillis;
  yield* setPreferredCurriculumProgram({
    now,
    programKey: program.key,
    userId,
  }).pipe(Effect.mapError(toPreferenceIoError));
  return {
    preferredCurriculumProgramKey: program.key,
    program,
  };
});
