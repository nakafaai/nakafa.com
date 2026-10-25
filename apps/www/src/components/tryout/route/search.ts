import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Effect, Schema } from "effect";
import { CatalogQuery } from "@/components/tryout/catalog/table/query";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import { QueryText } from "@/lib/routing/search";

/** The keys of one track that its learner's set list is read for. */
const TrackKeysSchema = Schema.Struct({
  countryKey: Schema.String,
  examKey: Schema.String,
  trackKey: Schema.String,
});

/**
 * The set list request of one track: its locale, its catalog query, its keys and
 * the number of rows to read. A visitor grows that number by loading more, and the
 * loader omits it for the first page.
 */
export const TrackListRequestSchema = Schema.Struct({
  locale: LocaleSchema,
  numItems: Schema.optionalKey(
    Schema.Int.check(
      Schema.isBetween({
        maximum: TRYOUT_CATALOG_LIMIT,
        minimum: TRYOUT_SET_PAGE_SIZE,
      })
    )
  ),
  search: CatalogQuery,
  track: TrackKeysSchema,
});

/**
 * One query value of an attempt page: its text, or the text of each repeated
 * value. A value of any other shape reads as empty, which the readers refuse as
 * invalid, so the page answers not found.
 */
const TryoutQueryValue = Schema.Union([
  QueryText,
  Schema.Array(QueryText),
]).pipe(Schema.catchDecoding(() => Effect.succeedSome("")));

/**
 * The address of an attempt page: its attempt capability and its player view.
 * Both stay raw here, because a page refuses an invalid value with not found, as
 * the attempt readers decide it.
 */
export const TryoutAttemptSearch = Schema.Struct({
  attemptId: Schema.optionalKey(TryoutQueryValue),
  view: Schema.optionalKey(TryoutQueryValue),
});

export type TryoutAttemptSearch = typeof TryoutAttemptSearch.Type;
