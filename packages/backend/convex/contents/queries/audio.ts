import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  internalQuery,
  type QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE,
  MIN_VIEW_THRESHOLD,
} from "@repo/backend/convex/audioStudies/constants";
import { getAudioContentSourceByContentId } from "@repo/backend/convex/audioStudies/helpers/sources";
import { mergePopularAudioContentItems } from "@repo/backend/convex/contents/helpers/popularity";
import { getLifetimePopularityWindow } from "@repo/backend/convex/contents/popularity";
import {
  type PopularAudioContentItem,
  popularAudioContentItemValidator,
} from "@repo/backend/convex/contents/validators";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import {
  type Locale,
  SUPPORTED_CONTENT_LOCALES,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

type PopularityCounterRow = Doc<"learningPopularityCounters">;

const popularAudioIoFailedCode = "POPULAR_AUDIO_IO_FAILED";
const popularAudioCandidateLookaheadMultiplier = 3;
const maxPopularAudioSourceLookupsPerType =
  MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE *
  popularAudioCandidateLookaheadMultiplier;

/** Raised when the audio queue candidate query cannot read its ranked models. */
class PopularAudioIoError extends Schema.TaggedError<PopularAudioIoError>()(
  "PopularAudioIoError",
  {
    code: Schema.Literal(popularAudioIoFailedCode),
    message: Schema.String,
  }
) {}

/** Maps thrown Convex IO failures into the popular-audio error channel. */
function toPopularAudioIoError(error: unknown) {
  return new PopularAudioIoError({
    code: popularAudioIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Reads bounded ranked popularity rows for one content section and locale. */
const loadPopularRowsForLocale = Effect.fn(
  "contents.audio.loadPopularRowsForLocale"
)(function* (
  ctx: QueryCtx,
  section: PopularityCounterRow["section"],
  locale: Locale
) {
  const windowKey = getLifetimePopularityWindow();
  const rows = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityCounters")
        .withIndex("by_section_locale_scope_window_score_id", (q) =>
          q
            .eq("section", section)
            .eq("locale", locale)
            .eq("scopeMode", "global")
            .eq("windowKey", windowKey)
        )
        .order("desc")
        .take(maxPopularAudioSourceLookupsPerType),
    catch: toPopularAudioIoError,
  });

  return rows.filter((row) => row.score >= MIN_VIEW_THRESHOLD);
});

/** Reads ranked popularity rows for one content section across supported locales. */
const loadPopularRows = Effect.fn("contents.audio.loadPopularRows")(function* (
  ctx: QueryCtx,
  section: PopularityCounterRow["section"]
) {
  const pages = yield* Effect.forEach(SUPPORTED_CONTENT_LOCALES, (locale) =>
    loadPopularRowsForLocale(ctx, section, locale)
  );

  return pages
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, maxPopularAudioSourceLookupsPerType);
});

/** Resolves one ranked popularity row to an audio source candidate. */
const loadAudioItem = Effect.fn("contents.audio.loadAudioItem")(function* (
  ctx: QueryCtx,
  row: PopularityCounterRow
) {
  const sourceContent = yield* Effect.tryPromise({
    try: () => getAudioContentSourceByContentId(ctx, row.content_id),
    catch: toPopularAudioIoError,
  });

  if (!sourceContent) {
    return null;
  }

  return {
    sourceContent,
    viewCount: row.score,
  };
});

/** Resolves enough audio-ready items from bounded ranked popularity candidates. */
const loadPopularAudioItems = Effect.fn("contents.audio.loadPopularAudioItems")(
  function* (ctx: QueryCtx, section: PopularityCounterRow["section"]) {
    const rows = yield* loadPopularRows(ctx, section);
    const items: PopularAudioContentItem[] = [];

    for (const row of rows) {
      const item = yield* loadAudioItem(ctx, row);

      if (item) {
        items.push(item);
      }

      if (items.length >= MAX_AUDIO_QUEUE_POPULAR_ITEMS_PER_TYPE) {
        break;
      }
    }

    return items;
  }
);

/** Reads current popular audio queue candidates from ranked learning counters. */
const listPopularAudioContent = Effect.fn(
  "contents.audio.listPopularAudioContent"
)(function* (ctx: QueryCtx) {
  const [articleItems, subjectItems] = yield* Effect.all([
    loadPopularAudioItems(ctx, "articles"),
    loadPopularAudioItems(ctx, "material"),
  ]);

  return mergePopularAudioContentItems([...articleItems, ...subjectItems]);
});

/**
 * Returns the current top article and subject candidates for audio generation.
 *
 * This query is used by an internal action so popularity reads never happen
 * inside the mutation that writes audio queue rows.
 */
export const getPopularContentForAudioQueue = internalQuery({
  args: {},
  returns: v.array(popularAudioContentItemValidator),
  handler: async (ctx): Promise<PopularAudioContentItem[]> =>
    await runConvexProgram(listPopularAudioContent(ctx)),
});
