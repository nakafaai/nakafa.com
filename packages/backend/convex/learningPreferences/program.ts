import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { PROGRAM_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyProgram } from "@repo/backend/convex/contentRelease/program/verify";
import {
  getLearningPreferenceByUserId,
  upsertPreferredCurriculumProgram,
} from "@repo/backend/convex/learningPreferences/impl";
import {
  getLearningProgramByKey,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/impl";
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

/** Converts a verified Aksara program into one localized selector option. */
function toPublishedProgramOption(
  program: LearningProgram,
  locale: Locale
): CurriculumProgramOption {
  const translation = program.translations[locale];
  return {
    ...(program.provider.homeCountry
      ? { countryCode: program.provider.homeCountry }
      : {}),
    key: program.key,
    publicSlug: translation.publicSlug,
    title: translation.title,
  };
}

/** Converts a source-backed program into one localized selector option. */
function toSourceProgramOption(
  program: Doc<"learningPrograms">,
  locale: Locale
): CurriculumProgramOption {
  const summary = toLearningProgramSummary(program, locale);
  return {
    ...(program.providerHomeCountry
      ? { countryCode: program.providerHomeCountry }
      : {}),
    key: summary.key,
    publicSlug: summary.publicSlug,
    title: summary.title,
  };
}

/** Reads one source-owned program while Aksara does not own the catalog. */
const readSourceProgram = Effect.fn("learningPreferences.readSourceProgram")(
  function* (ctx: QueryCtx | MutationCtx, programKey: string) {
    return yield* Effect.tryPromise({
      catch: toPreferenceIoError,
      try: () => getLearningProgramByKey(ctx, programKey),
    });
  }
);

/** Reads one localized school curriculum from the exclusive current owner. */
export const readCurriculumProgram = Effect.fn(
  "learningPreferences.readCurriculumProgram"
)(function* (ctx: QueryCtx | MutationCtx, locale: Locale, programKey: string) {
  const owner = yield* loadProgramOwner(ctx, locale);
  if (owner.managed && owner.selected) {
    const snapshotId = owner.selected.snapshotId;
    const stored = yield* Effect.tryPromise({
      catch: toPreferenceIoError,
      try: () =>
        ctx.db
          .query("programCatalog")
          .withIndex("by_snapshotId_and_programKey", (index) =>
            index.eq("snapshotId", snapshotId).eq("programKey", programKey)
          )
          .unique(),
    });
    if (!stored) {
      return null;
    }
    const program = yield* verifyProgram(stored, snapshotId);
    return program.kind === "school-curriculum"
      ? toPublishedProgramOption(program, locale)
      : null;
  }
  const program = yield* readSourceProgram(ctx, programKey);
  if (program?.kind !== "school-curriculum") {
    return null;
  }
  return toSourceProgramOption(program, locale);
});

/** Lists curriculum programs from the exclusive published or source owner. */
export const listCurriculumPrograms = Effect.fn(
  "learningPreferences.listCurriculumPrograms"
)(function* (ctx: QueryCtx, locale: Locale) {
  const owner = yield* loadProgramOwner(ctx, locale);
  if (owner.managed && owner.selected) {
    const snapshotId = owner.selected.snapshotId;
    const rows = yield* Effect.tryPromise({
      catch: toPreferenceIoError,
      try: () =>
        ctx.db
          .query("programCatalog")
          .withIndex("by_snapshotId_and_displayOrder_and_programKey", (index) =>
            index.eq("snapshotId", snapshotId)
          )
          .take(PROGRAM_CATALOG_LIMIT + 1),
    });
    if (rows.length > PROGRAM_CATALOG_LIMIT) {
      return yield* new CurriculumPreferenceError({
        code: curriculumPreferenceIoFailedCode,
        message: `Program catalog exceeds ${PROGRAM_CATALOG_LIMIT} rows.`,
      });
    }
    const programs = yield* Effect.forEach(rows, (row) =>
      verifyProgram(row, snapshotId)
    );
    const curricula = programs.filter(
      (program) => program.kind === "school-curriculum"
    );
    if (curricula.length > CURRICULUM_PROGRAM_LIMIT) {
      return yield* new CurriculumPreferenceError({
        code: curriculumPreferenceIoFailedCode,
        message: `Curriculum program catalog exceeds ${CURRICULUM_PROGRAM_LIMIT} rows.`,
      });
    }
    return curricula.map((program) =>
      toPublishedProgramOption(program, locale)
    );
  }
  const rows = yield* Effect.tryPromise({
    catch: toPreferenceIoError,
    try: () =>
      ctx.db
        .query("learningPrograms")
        .withIndex("by_kind_and_displayOrder", (index) =>
          index.eq("kind", "school-curriculum")
        )
        .take(CURRICULUM_PROGRAM_LIMIT + 1),
  });
  if (rows.length > CURRICULUM_PROGRAM_LIMIT) {
    return yield* new CurriculumPreferenceError({
      code: curriculumPreferenceIoFailedCode,
      message: `Curriculum program catalog exceeds ${CURRICULUM_PROGRAM_LIMIT} rows.`,
    });
  }
  return rows.map((program) => toSourceProgramOption(program, locale));
});

/** Resolves the learner's saved program against the current catalog owner. */
export const readCurrentCurriculumProgram = Effect.fn(
  "learningPreferences.readCurrentCurriculumProgram"
)(function* (ctx: QueryCtx, locale: Locale, userId: Id<"users">) {
  const preference = yield* Effect.tryPromise({
    catch: toPreferenceIoError,
    try: () => getLearningPreferenceByUserId(ctx, userId),
  });
  if (preference?.preferredCurriculumProgramKey) {
    const program = yield* readCurriculumProgram(
      ctx,
      locale,
      preference.preferredCurriculumProgramKey
    );
    if (program) {
      return {
        preferredCurriculumProgramKey: preference.preferredCurriculumProgramKey,
        program,
      };
    }
  }
  const profile = yield* Effect.tryPromise({
    catch: toPreferenceIoError,
    try: () =>
      ctx.db
        .query("learningProfiles")
        .withIndex("by_userId", (index) => index.eq("userId", userId))
        .unique(),
  });
  if (!profile) {
    return null;
  }
  const profileProgramKey =
    profile.programKey ??
    (yield* Effect.tryPromise({
      catch: toPreferenceIoError,
      try: () => ctx.db.get(profile.programId),
    }).pipe(Effect.map((program) => program?.key)));
  if (!profileProgramKey) {
    return null;
  }
  const program = yield* readCurriculumProgram(ctx, locale, profileProgramKey);
  if (!program) {
    return null;
  }
  return {
    preferredCurriculumProgramKey: profileProgramKey,
    program,
  };
});

/** Saves one verified curriculum preference under the current catalog owner. */
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
