import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  readTryoutCountryRoute,
  readTryoutExamRoute,
  readTryoutHubRoute,
  readTryoutTrackRoute,
  readTryoutTrackSetList,
} from "@/components/tryout/route/catalog.server";
import { TryoutTrackSearchFields } from "@/components/tryout/route/search";
import { runServerEffect } from "@/lib/server/fn";

/** The locale of every catalog request, already decoded by the locale route. */
const LocaleInput = Schema.Struct({ locale: LocaleSchema });

/** The address segments of a country page. */
const CountryInput = Schema.Struct({
  country: Schema.String,
  locale: LocaleSchema,
});

/** The address segments of an exam page. */
const ExamInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
});

/** The address segments of a track page. */
const TrackInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  track: Schema.String,
});

/** The keys of one track that the set list of the learner is read for. */
const TrackKeysInput = Schema.Struct({
  countryKey: Schema.String,
  examKey: Schema.String,
  trackKey: Schema.String,
});

/** The set list request: one track's keys, the locale and the catalog query. */
const TrackListInput = Schema.Struct({
  locale: LocaleSchema,
  search: TryoutTrackSearchFields,
  track: TrackKeysInput,
});

/** The hub page of one locale. */
export const readTryoutHubHandler = ({
  data,
}: {
  readonly data: typeof LocaleInput.Type;
}) => runServerEffect(readTryoutHubRoute(data.locale));

/** The hub page of one locale, read on the server for a loader. */
export const readTryoutHubFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(readTryoutHubHandler);

/** One country page, or the not-found decision when the catalog has none. */
export const readTryoutCountryHandler = ({
  data,
}: {
  readonly data: typeof CountryInput.Type;
}) => runServerEffect(readTryoutCountryRoute(data));

/** One country page, read on the server for a loader. */
export const readTryoutCountryFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CountryInput))
  .handler(readTryoutCountryHandler);

/** One exam page, or the not-found decision when the catalog has none. */
export const readTryoutExamHandler = ({
  data,
}: {
  readonly data: typeof ExamInput.Type;
}) => runServerEffect(readTryoutExamRoute(data));

/** One exam page, read on the server for a loader. */
export const readTryoutExamFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamInput))
  .handler(readTryoutExamHandler);

/** One track page, or the not-found decision when the catalog has none. */
export const readTryoutTrackHandler = ({
  data,
}: {
  readonly data: typeof TrackInput.Type;
}) => runServerEffect(readTryoutTrackRoute(data));

/** One track page, read on the server for a loader. */
export const readTryoutTrackFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackInput))
  .handler(readTryoutTrackHandler);

/** The learner's set list of one track: its arguments and the page of rows. */
interface TryoutTrackListResult {
  readonly args: Ref.Args<typeof tryouts.queries.sets.list>;
  readonly result: Ref.Returns<typeof tryouts.queries.sets.list>;
}

/** The learner's set list of one track, read per request. */
export const readTryoutTrackListHandler = ({
  data,
}: {
  readonly data: typeof TrackListInput.Type;
}): Promise<TryoutTrackListResult> =>
  runServerEffect(readTryoutTrackSetList(data));

/** The learner's set list of one track, read on the server for a loader. */
export const readTryoutTrackListFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackListInput))
  .handler(readTryoutTrackListHandler);
