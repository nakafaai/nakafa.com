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
import {
  isLearningProgramSelectable,
  listSignedPrograms,
} from "@repo/backend/convex/learningPrograms/selection";
import { programMatchesInterest } from "@repo/backend/convex/learningPrograms/spec";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import type { LearningInterest } from "@repo/contents/_types/program/schema";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

const cutover = new Migrations(components.migrations, {
  defaultBatchSize: 50,
  internalMutation,
});

const CUTOVER_AUDIT_LIMIT = 1000;
const PREFERENCE_RECOVERY_LIMIT = 100;
const learningSelectionAuditLimitCode = "LEARNING_SELECTION_AUDIT_LIMIT";
const learningSelectionMigrationIoFailedCode =
  "LEARNING_SELECTION_MIGRATION_IO_FAILED";
const learningSelectionMigrationUnresolvedCode =
  "LEARNING_SELECTION_MIGRATION_UNRESOLVED";

interface ResolvedLearningSelection {
  readonly interest: LearningInterest;
  readonly program: LearningProgram;
}

/** Expected migration or audit failure at the legacy cutover boundary. */
class LearningSelectionMigrationError extends Schema.TaggedError<LearningSelectionMigrationError>()(
  "LearningSelectionMigrationError",
  {
    code: Schema.Literal(
      learningSelectionAuditLimitCode,
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
  const canonicalSelection = readCanonicalSelection(preference, programs);
  const legacySelection = readLegacySelection(profile, legacyProgram, programs);

  if (
    canonicalSelection &&
    preference &&
    shouldPreserveCanonicalSelection({
      canonicalSelection,
      legacySelection,
      preference,
      profile,
    })
  ) {
    return;
  }

  if (!legacySelection) {
    return yield* new LearningSelectionMigrationError({
      code: learningSelectionMigrationUnresolvedCode,
      message: "A legacy learning profile has no valid signed program.",
    });
  }

  const now = yield* Clock.currentTimeMillis;
  yield* saveLearningSelection({
    ctx,
    interest: legacySelection.interest,
    now,
    programKey: legacySelection.program.key,
    programKind: legacySelection.program.kind,
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

/** Restores bounded curriculum preferences overwritten by the first cutover. */
export const restoreCurriculumPreferences = internalMutation({
  args: {
    rows: v.array(
      v.object({
        expectedCurrentProgramKey: v.string(),
        expectedPreferenceUpdatedAt: v.number(),
        programKey: v.string(),
        userId: v.id("users"),
      })
    ),
  },
  returns: v.object({ processed: v.number(), restored: v.number() }),
  handler: (ctx, args) =>
    runConvexProgram(restoreCurriculumPreferenceRows(ctx, args.rows)),
});

/** Restores exact backup values only while their live precondition still holds. */
const restoreCurriculumPreferenceRows = Effect.fn(
  "learningPrograms.restoreCurriculumPreferenceRows"
)(function* (
  ctx: MutationCtx,
  rows: readonly {
    expectedCurrentProgramKey: string;
    expectedPreferenceUpdatedAt: number;
    programKey: string;
    userId: Doc<"learningPreferences">["userId"];
  }[]
) {
  const userIds = new Set(rows.map(({ userId }) => userId));

  if (rows.length > PREFERENCE_RECOVERY_LIMIT || userIds.size !== rows.length) {
    return yield* new LearningSelectionMigrationError({
      code: learningSelectionAuditLimitCode,
      message: "Curriculum preference recovery input is invalid or unbounded.",
    });
  }

  const programs = yield* listSignedPrograms(ctx, "id");
  const curriculumKeys = new Set<string>(
    programs
      .filter(({ kind }) => kind === "school-curriculum")
      .map(({ key }) => key)
  );
  const now = yield* Clock.currentTimeMillis;
  const restored = yield* Effect.reduce(rows, 0, (count, row) =>
    Effect.gen(function* () {
      const preference = yield* readLearningPreferenceByUserId(ctx, row.userId);

      if (
        !preference ||
        preference.preferredCurriculumProgramKey !==
          row.expectedCurrentProgramKey ||
        preference.updatedAt !== row.expectedPreferenceUpdatedAt ||
        !curriculumKeys.has(row.programKey)
      ) {
        return yield* new LearningSelectionMigrationError({
          code: learningSelectionMigrationUnresolvedCode,
          message: "A curriculum preference recovery precondition failed.",
        });
      }

      if (preference.preferredCurriculumProgramKey === row.programKey) {
        return count;
      }

      yield* Effect.tryPromise({
        catch: toLearningSelectionMigrationIoError,
        try: () =>
          ctx.db.patch(preference._id, {
            preferredCurriculumProgramKey: row.programKey,
            updatedAt: now,
          }),
      });

      return count + 1;
    })
  );

  return { processed: rows.length, restored };
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
  const unresolvedProfiles = profiles.filter((profile) => {
    const preference = preferencesByUserId.get(profile.userId);
    return !(
      preference?.selectionUpdatedAt !== undefined &&
      isValidSelection(preference)
    );
  });

  return {
    invalidSelections: selectionRows.filter(
      (preference) => !isValidSelection(preference)
    ).length,
    legacyProfiles: profiles.length,
    missingSelectionTimestamps,
    migratedProfiles: profiles.length - unresolvedProfiles.length,
    selectionRows: selectionRows.length,
    unresolvedProfiles: unresolvedProfiles.length,
  };
});

/** Orders exact keys stored directly on the legacy selection boundary. */
function getExactProgramKeys(
  profile: Doc<"learningProfiles">,
  legacyProgram: Doc<"learningPrograms"> | null
) {
  return Array.from(
    new Set(
      [profile.programKey, legacyProgram?.key].filter(
        (candidate) => candidate !== undefined
      )
    )
  );
}

/** Reads one already-valid canonical selection without rewriting it. */
function readCanonicalSelection(
  preference: Doc<"learningPreferences"> | null,
  programs: readonly LearningProgram[]
) {
  if (!(preference?.learningInterest && preference.primaryProgramKey)) {
    return null;
  }

  const program = programs.find(
    (candidate) => candidate.key === preference.primaryProgramKey
  );

  if (
    !(
      program &&
      isLearningProgramSelectable(program) &&
      programMatchesInterest(program.kind, preference.learningInterest)
    )
  ) {
    return null;
  }

  return { interest: preference.learningInterest, program };
}

/** Resolves every legacy interest shape against its selected program first. */
function readLegacySelection(
  profile: Doc<"learningProfiles">,
  legacyProgram: Doc<"learningPrograms"> | null,
  programs: readonly LearningProgram[]
) {
  const interests = orderLegacyInterests(profile.interests, legacyProgram);
  const exactProgramKeys = getExactProgramKeys(profile, legacyProgram);

  for (const interest of interests) {
    const exactProgram = programs.find(
      (program) =>
        exactProgramKeys.includes(program.key) &&
        isLearningProgramSelectable(program) &&
        programMatchesInterest(program.kind, interest)
    );

    if (exactProgram) {
      return { interest, program: exactProgram };
    }
  }

  if (exactProgramKeys.length > 0) {
    return null;
  }

  for (const interest of interests) {
    const candidates = programs.filter(
      (program) =>
        isLearningProgramSelectable(program) &&
        programMatchesInterest(program.kind, interest)
    );

    if (candidates.length === 1) {
      return { interest, program: candidates[0] };
    }
  }

  return null;
}

/** Prioritizes interests compatible with the program the learner selected. */
function orderLegacyInterests(
  interests: readonly LearningInterest[],
  legacyProgram: Doc<"learningPrograms"> | null
) {
  const uniqueInterests = Array.from(new Set(interests));

  if (!legacyProgram) {
    return uniqueInterests;
  }

  return [
    ...uniqueInterests.filter((interest) =>
      programMatchesInterest(legacyProgram.kind, interest)
    ),
    ...uniqueInterests.filter(
      (interest) => !programMatchesInterest(legacyProgram.kind, interest)
    ),
  ];
}

/** Keeps a matching timestamped selection or a newer canonical write. */
function shouldPreserveCanonicalSelection({
  canonicalSelection,
  legacySelection,
  preference,
  profile,
}: {
  canonicalSelection: ResolvedLearningSelection;
  legacySelection: ResolvedLearningSelection | null;
  preference: Doc<"learningPreferences">;
  profile: Doc<"learningProfiles">;
}) {
  if (!legacySelection) {
    return true;
  }

  if (
    canonicalSelection.interest === legacySelection.interest &&
    canonicalSelection.program.key === legacySelection.program.key &&
    preference.selectionUpdatedAt !== undefined
  ) {
    return true;
  }

  if (preference.selectionUpdatedAt === undefined) {
    return false;
  }

  return preference.selectionUpdatedAt > profile.updatedAt;
}
