import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { readTryoutCountryCode } from "@repo/contents/_types/tryout/countries";
import { ConvexError } from "convex/values";

type PreferenceCtx = MutationCtx | QueryCtx;

/** Converts a try-out country row into the compact option used by navigation. */
export function toTryoutCountryOption(country: Doc<"tryoutCountries">) {
  return {
    countryCode: readSourceCountryCode(country.countryKey),
    key: country.countryKey,
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Resolves the country code owned by one authored try-out country key. */
function readSourceCountryCode(countryKey: string) {
  const countryCode = readTryoutCountryCode(countryKey);

  if (!countryCode) {
    throw new ConvexError({
      code: "TRYOUT_COUNTRY_SOURCE_NOT_FOUND",
      message: "Try-out country source not found.",
    });
  }

  return countryCode;
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

/** Loads one active try-out country by source key and locale. */
export async function getActiveTryoutCountryByKey({
  countryKey,
  ctx,
  locale,
}: {
  countryKey: string;
  ctx: PreferenceCtx;
  locale: Locale;
}) {
  const country = await ctx.db
    .query("tryoutCountries")
    .withIndex("by_countryKey_and_locale", (q) =>
      q.eq("countryKey", countryKey).eq("locale", locale)
    )
    .unique();

  if (!country?.isActive) {
    return null;
  }

  return country;
}

/** Reads the current explicit try-out country preference. */
export async function getCurrentTryoutCountry({
  ctx,
  locale,
  userId,
}: {
  ctx: PreferenceCtx;
  locale: Locale;
  userId: Id<"users">;
}) {
  const preference = await getLearningPreferenceByUserId(ctx, userId);

  if (!preference?.preferredTryoutCountryKey) {
    return null;
  }

  const country = await getActiveTryoutCountryByKey({
    countryKey: preference.preferredTryoutCountryKey,
    ctx,
    locale,
  });

  if (!country) {
    return null;
  }

  return {
    country,
    preferredTryoutCountryKey: preference.preferredTryoutCountryKey,
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

/** Creates or updates the current user's preferred try-out country key. */
export async function upsertPreferredTryoutCountry({
  countryKey,
  ctx,
  now,
  userId,
}: {
  countryKey: string;
  ctx: MutationCtx;
  now: number;
  userId: Id<"users">;
}) {
  const current = await getLearningPreferenceByUserId(ctx, userId);

  if (!current) {
    return await ctx.db.insert("learningPreferences", {
      preferredTryoutCountryKey: countryKey,
      updatedAt: now,
      userId,
    });
  }

  if (current.preferredTryoutCountryKey === countryKey) {
    return current._id;
  }

  await ctx.db.patch(current._id, {
    preferredTryoutCountryKey: countryKey,
    updatedAt: now,
  });

  return current._id;
}
