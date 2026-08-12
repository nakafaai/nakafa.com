import { Migrations } from "@convex-dev/migrations";
import { components } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  getLearningPreferenceByUserId,
  upsertLearningSelection,
} from "@repo/backend/convex/learningPreferences/impl";
import {
  isLearningProgramSelectable,
  listSignedPrograms,
  readSignedProgram,
} from "@repo/backend/convex/learningPrograms/selection";
import { programMatchesInterest } from "@repo/backend/convex/learningPrograms/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { LearningInterest } from "@repo/contents/_types/program/schema";
import { ConvexError, v } from "convex/values";

const cutover = new Migrations(components.migrations, {
  defaultBatchSize: 50,
  internalMutation,
});

const CUTOVER_AUDIT_LIMIT = 1000;
const DEFAULT_EXAM_PROGRAM_KEY = "snbt";
const DEFAULT_SCHOOL_PROGRAM_KEY = "merdeka";

/** Moves the durable learner choice out of generated profile and plan tables. */
export const migrateLearningSelections = cutover.define({
  table: "learningProfiles",
  migrateOne: async (ctx, profile) => {
    const preference = await getLearningPreferenceByUserId(ctx, profile.userId);
    const legacyProgram = await ctx.db.get(profile.programId);
    const [canonicalSelection, legacySelection] = await Promise.all([
      readCanonicalSelection(ctx, preference),
      readLegacySelection(ctx, profile, legacyProgram, preference),
    ]);

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
      throw new ConvexError({
        code: "LEARNING_SELECTION_MIGRATION_UNRESOLVED",
        message: "A legacy learning profile has no valid signed program.",
      });
    }

    await upsertLearningSelection({
      ctx,
      interest: legacySelection.interest,
      now: Date.now(),
      programKey: legacySelection.program.key,
      programKind: legacySelection.program.kind,
      userId: profile.userId,
    });
  },
});

/** Proves every legacy profile has one valid canonical signed selection. */
export const auditLearningSelections = internalQuery({
  args: {},
  returns: v.object({
    invalidSelections: v.number(),
    legacyProfiles: v.number(),
    migratedProfiles: v.number(),
    selectionRows: v.number(),
    unresolvedProfiles: v.number(),
  }),
  handler: async (ctx) => {
    const [preferences, profiles, programs] = await Promise.all([
      ctx.db.query("learningPreferences").take(CUTOVER_AUDIT_LIMIT + 1),
      ctx.db.query("learningProfiles").take(CUTOVER_AUDIT_LIMIT + 1),
      runConvexProgram(listSignedPrograms(ctx, "id")),
    ]);

    if (
      preferences.length > CUTOVER_AUDIT_LIMIT ||
      profiles.length > CUTOVER_AUDIT_LIMIT
    ) {
      throw new ConvexError({
        code: "LEARNING_SELECTION_AUDIT_LIMIT",
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
      return !(preference && isValidSelection(preference));
    });

    return {
      invalidSelections: selectionRows.filter(
        (preference) => !isValidSelection(preference)
      ).length,
      legacyProfiles: profiles.length,
      migratedProfiles: profiles.length - unresolvedProfiles.length,
      selectionRows: selectionRows.length,
      unresolvedProfiles: unresolvedProfiles.length,
    };
  },
});

/** Orders grounded legacy keys for one candidate interest. */
function getCandidateProgramKeys({
  interest,
  legacyProgramKey,
  preference,
}: {
  interest: LearningInterest;
  legacyProgramKey?: string;
  preference: Doc<"learningPreferences"> | null;
}) {
  const candidates =
    interest === "school-curriculum"
      ? [
          preference?.preferredCurriculumProgramKey,
          legacyProgramKey,
          DEFAULT_SCHOOL_PROGRAM_KEY,
        ]
      : [legacyProgramKey, DEFAULT_EXAM_PROGRAM_KEY];

  return Array.from(
    new Set(candidates.filter((candidate) => candidate !== undefined))
  );
}

/** Reads one already-valid canonical selection without rewriting it. */
async function readCanonicalSelection(
  ctx: Parameters<typeof getLearningPreferenceByUserId>[0],
  preference: Doc<"learningPreferences"> | null
) {
  if (!(preference?.learningInterest && preference.primaryProgramKey)) {
    return null;
  }

  const program = await runConvexProgram(
    readSignedProgram(ctx, "id", preference.primaryProgramKey)
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
async function readLegacySelection(
  ctx: Parameters<typeof getLearningPreferenceByUserId>[0],
  profile: Doc<"learningProfiles">,
  legacyProgram: Doc<"learningPrograms"> | null,
  preference: Doc<"learningPreferences"> | null
) {
  const interests = orderLegacyInterests(profile.interests, legacyProgram);

  for (const interest of interests) {
    const candidateKeys = getCandidateProgramKeys({
      interest,
      legacyProgramKey: legacyProgram?.key,
      preference,
    });
    const program = await readFirstValidProgram(ctx, interest, candidateKeys);

    if (program) {
      return { interest, program };
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

/** Keeps a matching selection or a canonical write newer than legacy state. */
function shouldPreserveCanonicalSelection({
  canonicalSelection,
  legacySelection,
  preference,
  profile,
}: {
  canonicalSelection: NonNullable<
    Awaited<ReturnType<typeof readCanonicalSelection>>
  >;
  legacySelection: Awaited<ReturnType<typeof readLegacySelection>>;
  preference: Doc<"learningPreferences">;
  profile: Doc<"learningProfiles">;
}) {
  if (!legacySelection) {
    return true;
  }

  if (
    canonicalSelection.interest === legacySelection.interest &&
    canonicalSelection.program.key === legacySelection.program.key
  ) {
    return true;
  }

  return preference.updatedAt > profile.updatedAt;
}

/** Returns the first candidate that exists and matches the signed catalog. */
async function readFirstValidProgram(
  ctx: Parameters<typeof getLearningPreferenceByUserId>[0],
  interest: LearningInterest,
  candidateKeys: readonly string[]
) {
  for (const candidateKey of candidateKeys) {
    const program = await runConvexProgram(
      readSignedProgram(ctx, "id", candidateKey)
    );

    if (
      program &&
      isLearningProgramSelectable(program) &&
      programMatchesInterest(program.kind, interest)
    ) {
      return program;
    }
  }

  return null;
}
