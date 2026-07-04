import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  getLearningProgramByKey,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/impl";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

const CURRICULUM_PROGRAM_LIMIT = 50;

type PreferenceCtx = MutationCtx | QueryCtx;

/** Converts a catalog program row into the compact curriculum option shown in UI. */
export function toCurriculumProgramOption(
  program: Doc<"learningPrograms">,
  locale?: Locale
) {
  const summary = toLearningProgramSummary(program, locale);

  return {
    countryCode: program.providerHomeCountry,
    key: summary.key,
    publicSlug: summary.publicSlug,
    title: summary.title,
  };
}

/** Checks whether one learning program can be used as a curriculum preference. */
export function isSchoolCurriculumProgram(program: Doc<"learningPrograms">) {
  return program.kind === "school-curriculum";
}

/** Reads every curriculum program option from the catalog in display order. */
export async function listSchoolCurriculumPrograms(ctx: PreferenceCtx) {
  return await ctx.db
    .query("learningPrograms")
    .withIndex("by_kind_and_displayOrder", (q) =>
      q.eq("kind", "school-curriculum")
    )
    .take(CURRICULUM_PROGRAM_LIMIT);
}

/** Loads the saved preference row for one app user. */
export async function getLearningPreferenceByUserId(
  ctx: PreferenceCtx,
  userId: Id<"users">
) {
  return await ctx.db
    .query("learningPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/** Loads one school-curriculum program by its stable program key. */
export async function getSchoolCurriculumProgramByKey(
  ctx: PreferenceCtx,
  programKey: string
) {
  const program = await getLearningProgramByKey(ctx, programKey);

  if (!(program && isSchoolCurriculumProgram(program))) {
    return null;
  }

  return program;
}

/** Reads the current curriculum from explicit preference, then onboarding profile. */
export async function getCurrentCurriculumProgram(
  ctx: PreferenceCtx,
  userId: Id<"users">
) {
  const preference = await getLearningPreferenceByUserId(ctx, userId);

  if (preference) {
    const program = await getSchoolCurriculumProgramByKey(
      ctx,
      preference.preferredCurriculumProgramKey
    );

    if (program) {
      return {
        preferredCurriculumProgramKey: preference.preferredCurriculumProgramKey,
        program,
      };
    }
  }

  const profile = await ctx.db
    .query("learningProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!profile) {
    return null;
  }

  const program = await ctx.db.get(profile.programId);

  if (!(program && isSchoolCurriculumProgram(program))) {
    return null;
  }

  return {
    preferredCurriculumProgramKey: program.key,
    program,
  };
}

/** Creates or updates the current user's preferred curriculum program key. */
export async function upsertPreferredCurriculumProgram({
  ctx,
  now,
  programKey,
  userId,
}: {
  ctx: MutationCtx;
  now: number;
  programKey: string;
  userId: Id<"users">;
}) {
  const current = await getLearningPreferenceByUserId(ctx, userId);

  if (!current) {
    return await ctx.db.insert("learningPreferences", {
      preferredCurriculumProgramKey: programKey,
      updatedAt: now,
      userId,
    });
  }

  if (current.preferredCurriculumProgramKey === programKey) {
    return current._id;
  }

  await ctx.db.patch(current._id, {
    preferredCurriculumProgramKey: programKey,
    updatedAt: now,
  });

  return current._id;
}
