import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, type Infer } from "convex/values";

type TryoutLocale = Infer<typeof localeValidator>;
type TryoutSet = Doc<"tryoutSets">;

interface TryoutSetIdentity {
  countryKey: string;
  examKey: string;
  locale: TryoutLocale;
  setKey: string;
  trackKey: string;
}

interface TryoutSetPublicPath {
  locale: TryoutLocale;
  publicPath: string;
}

/** Finds one active try-out set by the public source identity. */
export async function getActiveTryoutSet(
  ctx: MutationCtx | QueryCtx,
  args: TryoutSetIdentity
): Promise<TryoutSet | null> {
  const set = await ctx.db
    .query("tryoutSets")
    .withIndex(
      "by_countryKey_and_examKey_and_trackKey_and_setKey_and_locale",
      (q) =>
        q
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("trackKey", args.trackKey)
          .eq("setKey", args.setKey)
          .eq("locale", args.locale)
    )
    .unique();

  if (!set?.isActive) {
    return null;
  }

  return set;
}

/** Finds one active try-out set by its localized public path. */
export async function getActiveTryoutSetByPublicPath(
  ctx: MutationCtx | QueryCtx,
  args: TryoutSetPublicPath
): Promise<TryoutSet | null> {
  const set = await ctx.db
    .query("tryoutSets")
    .withIndex("by_locale_and_publicPath", (q) =>
      q.eq("locale", args.locale).eq("publicPath", args.publicPath)
    )
    .unique();

  if (!set?.isActive) {
    return null;
  }

  return set;
}

/** Loads one active try-out set or raises a typed Convex domain error. */
export async function requireActiveTryoutSet(
  ctx: MutationCtx | QueryCtx,
  args: TryoutSetIdentity
): Promise<TryoutSet> {
  const set = await getActiveTryoutSet(ctx, args);

  if (!set) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_FOUND",
      message: "Try-out set not found.",
    });
  }

  return set;
}

/** Loads one active ready try-out set whose country, exam, and track are public. */
export async function requireActiveReadyTryoutSet(
  ctx: MutationCtx | QueryCtx,
  args: TryoutSetIdentity
): Promise<TryoutSet> {
  const set = await requireActiveTryoutSet(ctx, args);

  if (!set.isReady) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_READY",
      message: "Try-out set is not ready.",
    });
  }

  const [country, exam, track] = await Promise.all([
    ctx.db
      .query("tryoutCountries")
      .withIndex("by_countryKey_and_locale", (q) =>
        q.eq("countryKey", set.countryKey).eq("locale", set.locale)
      )
      .unique(),
    ctx.db
      .query("tryoutExams")
      .withIndex("by_countryKey_and_examKey_and_locale", (q) =>
        q
          .eq("countryKey", set.countryKey)
          .eq("examKey", set.examKey)
          .eq("locale", set.locale)
      )
      .unique(),
    ctx.db
      .query("tryoutTracks")
      .withIndex("by_countryKey_and_examKey_and_trackKey_and_locale", (q) =>
        q
          .eq("countryKey", set.countryKey)
          .eq("examKey", set.examKey)
          .eq("trackKey", set.trackKey)
          .eq("locale", set.locale)
      )
      .unique(),
  ]);

  if (!(country?.isActive && exam?.isActive && track?.isActive)) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_FOUND",
      message: "Try-out set not found.",
    });
  }

  if (!track.isReady) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_READY",
      message: "Try-out set is not ready.",
    });
  }

  return set;
}
