import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Effect, Schema, SchemaTransformation } from "effect";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";

/**
 * TanStack reads a query value that starts like JSON as its JSON value, so
 * `view=1` arrives as the number 1 and `view=false` as false. The readers classify
 * the text a learner wrote, so a parsed scalar goes back to that text.
 */
const QueryScalarText = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
]).pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform({
      decode: (value) => (typeof value === "string" ? value : String(value)),
      encode: (text) => text,
    })
  )
);

/** One optional catalog query value of a track. A value that does not read as text reads as none. */
const TrackQueryValue = Schema.optionalKey(
  QueryScalarText.pipe(Schema.catchDecoding(() => Effect.succeedNone))
);

/**
 * The catalog query of a track page: its status filter, sort and direction. Each
 * value decodes on its own, so one malformed value keeps the other two.
 */
export const TryoutTrackSearch = Schema.Struct({
  direction: TrackQueryValue,
  sort: TrackQueryValue,
  status: TrackQueryValue,
});

export type TryoutTrackSearch = typeof TryoutTrackSearch.Type;

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
  search: TryoutTrackSearch,
  track: TrackKeysSchema,
});

/**
 * One query value of an attempt page: its text, or the text of each repeated
 * value. A value of any other shape reads as empty, which the readers refuse as
 * invalid, so the page answers not found.
 */
const TryoutQueryValue = Schema.Union([
  QueryScalarText,
  Schema.Array(QueryScalarText),
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
