import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutCountry } from "@nakafa/aksara-contracts/tryout/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { readTryoutCatalogRowByIdentity } from "@repo/backend/convex/tryouts/catalog/row";
import { Effect } from "effect";

type PreferenceCtx = MutationCtx | QueryCtx;

/** Converts a try-out country row into the compact option used by navigation. */
export function toTryoutCountryOption(country: TryoutCountry) {
  return {
    countryCode: country.countryCode,
    key: country.countryKey,
    publicPath: country.publicPath,
    title: country.title,
  };
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

/** Loads one active try-out country from the signed catalog. */
export const readActiveTryoutCountry = Effect.fn(
  "learningPreferences.readActiveTryoutCountry"
)(function* (
  ctx: QueryCtx,
  args: { readonly countryKey: string; readonly locale: Locale }
) {
  const owner = yield* loadTryoutOwner(ctx);
  const identity = tryoutCatalogIdentity({
    countryKey: args.countryKey,
    kind: "country",
    locale: args.locale,
  });
  const country = yield* readTryoutCatalogRowByIdentity(
    ctx,
    owner.snapshotId,
    identity
  );
  return country?.kind === "country" ? country : null;
});

/** Reads the current explicit try-out country preference. */
export const readCurrentTryoutCountry = Effect.fn(
  "learningPreferences.readCurrentTryoutCountry"
)(function* (
  ctx: QueryCtx,
  args: { readonly locale: Locale; readonly userId: Id<"users"> }
) {
  const preference = yield* Effect.promise(() =>
    getLearningPreferenceByUserId(ctx, args.userId)
  );

  if (!preference?.preferredTryoutCountryKey) {
    return null;
  }

  const country = yield* readActiveTryoutCountry(ctx, {
    countryKey: preference.preferredTryoutCountryKey,
    locale: args.locale,
  });

  if (!country) {
    return null;
  }

  return {
    country,
    preferredTryoutCountryKey: preference.preferredTryoutCountryKey,
  };
});

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
