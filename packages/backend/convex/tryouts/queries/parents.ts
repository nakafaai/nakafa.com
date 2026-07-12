import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";

type TryoutSetParentIdentity = Pick<
  Doc<"tryoutSets">,
  "countryKey" | "examKey" | "locale" | "trackKey"
>;

/** Loads the active exam and ready track only when their country is active. */
export async function loadActiveTryoutSetParents(
  ctx: QueryCtx,
  set: TryoutSetParentIdentity
) {
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

  if (
    !(country?.isActive && exam?.isActive && track?.isActive && track.isReady)
  ) {
    return null;
  }

  return { exam, track };
}
