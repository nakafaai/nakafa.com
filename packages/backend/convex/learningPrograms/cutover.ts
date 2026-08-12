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
    const interest = readSingleInterest(profile);
    const preference = await getLearningPreferenceByUserId(ctx, profile.userId);
    const legacyProgram = await ctx.db.get(profile.programId);
    const candidateKeys = getCandidateProgramKeys({
      interest,
      legacyProgramKey: legacyProgram?.key,
      preference,
    });
    const program = await readFirstValidProgram(ctx, interest, candidateKeys);

    if (!program) {
      throw new ConvexError({
        code: "LEARNING_SELECTION_MIGRATION_UNRESOLVED",
        message: "A legacy learning profile has no valid signed program.",
      });
    }

    await upsertLearningSelection({
      ctx,
      interest,
      now: Date.now(),
      programKey: program.key,
      programKind: program.kind,
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

/** Requires a legacy profile to contain exactly one durable interest. */
function readSingleInterest(profile: Doc<"learningProfiles">) {
  const [interest] = profile.interests;

  if (profile.interests.length !== 1 || !interest) {
    throw new ConvexError({
      code: "LEARNING_SELECTION_MIGRATION_INTERESTS",
      message: "A legacy learning profile must have exactly one interest.",
    });
  }

  return interest;
}

/** Orders grounded candidates so newer explicit preferences win. */
function getCandidateProgramKeys({
  interest,
  legacyProgramKey,
  preference,
}: {
  interest: LearningInterest;
  legacyProgramKey?: string;
  preference: Doc<"learningPreferences"> | null;
}) {
  const candidates = [preference?.primaryProgramKey];

  if (interest === "school-curriculum") {
    candidates.push(
      preference?.preferredCurriculumProgramKey,
      legacyProgramKey,
      DEFAULT_SCHOOL_PROGRAM_KEY
    );
  } else {
    candidates.push(legacyProgramKey, DEFAULT_EXAM_PROGRAM_KEY);
  }

  return Array.from(
    new Set(candidates.filter((candidate) => candidate !== undefined))
  );
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
