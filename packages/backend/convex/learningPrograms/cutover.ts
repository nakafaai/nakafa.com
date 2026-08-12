import { Migrations } from "@convex-dev/migrations";
import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import { components } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  readLearningPreferenceByUserId,
  saveLearningSelection,
} from "@repo/backend/convex/learningPreferences/impl";
import { resolveLearningSelectionAuthority } from "@repo/backend/convex/learningPrograms/cutover/authority";
import {
  isLearningProgramSelectable,
  listSignedPrograms,
} from "@repo/backend/convex/learningPrograms/selection";
import { programMatchesInterest } from "@repo/backend/convex/learningPrograms/spec";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

const cutover = new Migrations(components.migrations, {
  defaultBatchSize: 50,
  internalMutation,
});

const CUTOVER_AUDIT_LIMIT = 1000;
const learningSelectionAuditLimitCode = "LEARNING_SELECTION_AUDIT_LIMIT";
const learningSelectionDuplicatePreferenceCode =
  "LEARNING_SELECTION_DUPLICATE_PREFERENCE";
const learningSelectionMigrationIoFailedCode =
  "LEARNING_SELECTION_MIGRATION_IO_FAILED";
const learningSelectionMigrationUnresolvedCode =
  "LEARNING_SELECTION_MIGRATION_UNRESOLVED";

/** Expected migration or audit failure at the legacy cutover boundary. */
class LearningSelectionMigrationError extends Schema.TaggedError<LearningSelectionMigrationError>()(
  "LearningSelectionMigrationError",
  {
    code: Schema.Literal(
      learningSelectionAuditLimitCode,
      learningSelectionDuplicatePreferenceCode,
      learningSelectionMigrationIoFailedCode,
      learningSelectionMigrationUnresolvedCode
    ),
    message: Schema.String,
  }
) {}

/** Maps unknown legacy database failures into the migration error channel. */
function toLearningSelectionMigrationIoError(error: unknown) {
  return new LearningSelectionMigrationError({
    code: learningSelectionMigrationIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Moves the durable learner choice out of generated profile and plan tables. */
export const migrateLearningSelections = cutover.define({
  table: "learningProfiles",
  migrateOne: (ctx, profile) =>
    runConvexProgram(migrateLearningSelection(ctx, profile)),
});

/** Migrates one legacy profile through a single composed Effect runtime. */
const migrateLearningSelection = Effect.fn(
  "learningPrograms.migrateLearningSelection"
)(function* (ctx: MutationCtx, profile: Doc<"learningProfiles">) {
  const preference = yield* readLearningPreferenceByUserId(ctx, profile.userId);
  const legacyProgram = yield* Effect.tryPromise({
    catch: toLearningSelectionMigrationIoError,
    try: () => ctx.db.get(profile.programId),
  });
  const programs = yield* listSignedPrograms(ctx, "id");
  const authority = resolveLearningSelectionAuthority({
    legacyProgram,
    preference,
    profile,
    programs,
  });

  if (authority._tag === "Canonical") {
    return;
  }

  if (authority._tag === "Unresolved") {
    return yield* new LearningSelectionMigrationError({
      code: learningSelectionMigrationUnresolvedCode,
      message: `Learning selection authority is unresolved: ${authority.reason}.`,
    });
  }

  const now = yield* Clock.currentTimeMillis;
  yield* saveLearningSelection({
    ctx,
    interest: authority.selection.interest,
    now,
    programKey: authority.selection.program.key,
    programKind: authority.selection.program.kind,
    replaceCurriculumPreference: false,
    selectionUpdatedAt: profile.updatedAt,
    userId: profile.userId,
  });
});

/** Proves every legacy profile has one valid canonical signed selection. */
export const auditLearningSelections = internalQuery({
  args: {},
  returns: v.object({
    invalidSelections: v.number(),
    legacyProfiles: v.number(),
    missingSelectionTimestamps: v.number(),
    migratedProfiles: v.number(),
    selectionRows: v.number(),
    unresolvedProfiles: v.number(),
  }),
  handler: (ctx) => runConvexProgram(auditLearningSelectionRows(ctx)),
});

/** Audits the bounded legacy and canonical rows in one composed program. */
const auditLearningSelectionRows = Effect.fn(
  "learningPrograms.auditLearningSelectionRows"
)(function* (ctx: QueryCtx) {
  const [preferences, profiles, programs] = yield* Effect.all(
    [
      Effect.tryPromise({
        catch: toLearningSelectionMigrationIoError,
        try: () =>
          ctx.db.query("learningPreferences").take(CUTOVER_AUDIT_LIMIT + 1),
      }),
      Effect.tryPromise({
        catch: toLearningSelectionMigrationIoError,
        try: () =>
          ctx.db.query("learningProfiles").take(CUTOVER_AUDIT_LIMIT + 1),
      }),
      listSignedPrograms(ctx, "id"),
    ],
    { concurrency: "unbounded" }
  );

  if (
    preferences.length > CUTOVER_AUDIT_LIMIT ||
    profiles.length > CUTOVER_AUDIT_LIMIT
  ) {
    return yield* new LearningSelectionMigrationError({
      code: learningSelectionAuditLimitCode,
      message: `Learning selection audit exceeds ${CUTOVER_AUDIT_LIMIT} rows.`,
    });
  }

  const programsByKey = new Map<string, (typeof programs)[number]>(
    programs.map((program) => [program.key, program])
  );
  const preferenceUserIds = new Set<string>();
  for (const preference of preferences) {
    if (preferenceUserIds.has(preference.userId)) {
      return yield* new LearningSelectionMigrationError({
        code: learningSelectionDuplicatePreferenceCode,
        message: "A learner has multiple learning preference rows.",
      });
    }

    preferenceUserIds.add(preference.userId);
  }

  const preferencesByUserId = new Map(
    preferences.map((preference) => [preference.userId, preference])
  );
  const selectionRows = preferences.filter(
    (preference) =>
      preference.learningInterest !== undefined &&
      preference.primaryProgramKey !== undefined
  );
  const missingSelectionTimestamps = selectionRows.filter(
    (preference) => preference.selectionUpdatedAt === undefined
  ).length;
  const isValidSelection = (preference: Doc<"learningPreferences">) => {
    if (!(preference.learningInterest && preference.primaryProgramKey)) {
      return false;
    }

    const program = programsByKey.get(preference.primaryProgramKey);

    return Boolean(
      program &&
        isLearningProgramSelectable(program) &&
        programMatchesInterest(program.kind, preference.learningInterest)
    );
  };
  const migratedProfiles = yield* Effect.forEach(
    profiles,
    (profile) =>
      Effect.tryPromise({
        catch: toLearningSelectionMigrationIoError,
        try: () => ctx.db.get(profile.programId),
      }).pipe(
        Effect.map((legacyProgram) =>
          isLearningSelectionMigrated({
            legacyProgram,
            preference: preferencesByUserId.get(profile.userId) ?? null,
            profile,
            programs,
          })
        )
      ),
    { concurrency: "unbounded" }
  );
  const migratedProfileCount = migratedProfiles.filter(Boolean).length;

  return {
    invalidSelections: selectionRows.filter(
      (preference) => !isValidSelection(preference)
    ).length,
    legacyProfiles: profiles.length,
    missingSelectionTimestamps,
    migratedProfiles: migratedProfileCount,
    selectionRows: selectionRows.length,
    unresolvedProfiles: profiles.length - migratedProfileCount,
  };
});

/** Proves the canonical row is at least as current as its legacy source. */
function isLearningSelectionMigrated({
  legacyProgram,
  preference,
  profile,
  programs,
}: {
  legacyProgram: Doc<"learningPrograms"> | null;
  preference: Doc<"learningPreferences"> | null;
  profile: Doc<"learningProfiles">;
  programs: readonly LearningProgram[];
}) {
  return (
    resolveLearningSelectionAuthority({
      legacyProgram,
      preference,
      profile,
      programs,
    })._tag === "Canonical"
  );
}
