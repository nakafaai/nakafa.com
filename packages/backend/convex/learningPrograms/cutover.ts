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
const learningSelectionAuditLimitCode = "LEARNING_SELECTION_AUDIT_LIMIT";
const learningSelectionDuplicatePreferenceCode =
  "LEARNING_SELECTION_DUPLICATE_PREFERENCE";
const learningSelectionMigrationIoFailedCode =
  "LEARNING_SELECTION_MIGRATION_IO_FAILED";
const learningSelectionMigrationUnresolvedCode =
  "LEARNING_SELECTION_MIGRATION_UNRESOLVED";

interface ResolvedLearningSelection {
  readonly interest: LearningInterest;
  readonly program: LearningProgram;
}

type ExactProgramIdentity =
  | { readonly _tag: "Conflict" }
  | { readonly _tag: "Resolved"; readonly key: string | null };

type LegacySelectionResolution =
  | { readonly _tag: "Conflict" }
  | { readonly _tag: "Missing" }
  | {
      readonly _tag: "Resolved";
      readonly selection: ResolvedLearningSelection;
    };

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
  const canonicalSelection = readCanonicalSelection(preference, programs);
  const legacyResolution = readLegacySelection(
    profile,
    legacyProgram,
    programs
  );
  const legacySelection =
    legacyResolution._tag === "Resolved" ? legacyResolution.selection : null;

  if (legacyResolution._tag === "Conflict") {
    return yield* new LearningSelectionMigrationError({
      code: learningSelectionMigrationUnresolvedCode,
      message: "A legacy learning profile has conflicting program identities.",
    });
  }

  const selectionAuthority =
    canonicalSelection && preference
      ? getSelectionAuthority({
          canonicalSelection,
          legacySelection,
          preference,
          profile,
        })
      : "legacy";

  if (selectionAuthority === "canonical") {
    return;
  }

  if (selectionAuthority === "unresolved") {
    return yield* new LearningSelectionMigrationError({
      code: learningSelectionMigrationUnresolvedCode,
      message: "Canonical and legacy selections have ambiguous write order.",
    });
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

/** Resolves one exact retained identity or rejects conflicting legacy keys. */
function readExactProgramKey(
  profile: Doc<"learningProfiles">,
  legacyProgram: Doc<"learningPrograms"> | null
): ExactProgramIdentity {
  if (
    profile.programKey !== undefined &&
    legacyProgram !== null &&
    profile.programKey !== legacyProgram.key
  ) {
    return { _tag: "Conflict" };
  }

  return {
    _tag: "Resolved",
    key: profile.programKey ?? legacyProgram?.key ?? null,
  };
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
): LegacySelectionResolution {
  const interests = orderLegacyInterests(profile.interests, legacyProgram);
  const exactIdentity = readExactProgramKey(profile, legacyProgram);

  if (exactIdentity._tag === "Conflict") {
    return exactIdentity;
  }

  if (exactIdentity.key !== null) {
    for (const interest of interests) {
      const exactProgram = programs.find(
        (program) =>
          program.key === exactIdentity.key &&
          isLearningProgramSelectable(program) &&
          programMatchesInterest(program.kind, interest)
      );

      if (exactProgram) {
        return {
          _tag: "Resolved",
          selection: { interest, program: exactProgram },
        };
      }
    }

    return { _tag: "Missing" };
  }

  for (const interest of interests) {
    const candidates = programs.filter(
      (program) =>
        isLearningProgramSelectable(program) &&
        programMatchesInterest(program.kind, interest)
    );

    if (candidates.length === 1) {
      return {
        _tag: "Resolved",
        selection: { interest, program: candidates[0] },
      };
    }
  }

  return { _tag: "Missing" };
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
  if (preference?.selectionUpdatedAt === undefined) {
    return false;
  }

  const canonicalSelection = readCanonicalSelection(preference, programs);
  if (!canonicalSelection) {
    return false;
  }

  const legacyResolution: LegacySelectionResolution = readLegacySelection(
    profile,
    legacyProgram,
    programs
  );

  if (legacyResolution._tag === "Conflict") {
    return false;
  }

  const legacySelection =
    legacyResolution._tag === "Resolved" ? legacyResolution.selection : null;

  return (
    getSelectionAuthority({
      canonicalSelection,
      legacySelection,
      preference,
      profile,
    }) === "canonical"
  );
}

/** Selects the provably newer write and rejects equal conflicting timestamps. */
function getSelectionAuthority({
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
    const canonicalIsCurrent =
      preference.selectionUpdatedAt !== undefined &&
      preference.selectionUpdatedAt >= profile.updatedAt;
    return canonicalIsCurrent ? "canonical" : "unresolved";
  }

  if (
    canonicalSelection.interest === legacySelection.interest &&
    canonicalSelection.program.key === legacySelection.program.key &&
    preference.selectionUpdatedAt !== undefined
  ) {
    return "canonical";
  }

  if (preference.selectionUpdatedAt === undefined) {
    return "legacy";
  }

  if (preference.selectionUpdatedAt > profile.updatedAt) {
    return "canonical";
  }

  if (preference.selectionUpdatedAt < profile.updatedAt) {
    return "legacy";
  }

  return "unresolved";
}
