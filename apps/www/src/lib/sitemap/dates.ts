import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect } from "effect";
import { queryContentStore } from "@/lib/content/store/query";

/** Reads the day each snapshot family of the active release last changed. */
export const readSitemapDates = Effect.fn("www.sitemap.dates")(function* () {
  return yield* queryContentStore(contentRelease.runtime.active.dates, {});
});

/** The dates of the families whose pages author none of their own. */
export type SitemapDates = Effect.Success<ReturnType<typeof readSitemapDates>>;
