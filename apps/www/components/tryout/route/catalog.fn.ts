import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import type { Effect } from "effect";
import { Schema } from "effect";
import {
  readTryoutCountryRoute,
  readTryoutExamRoute,
  readTryoutHubRoute,
  readTryoutTrackRoute,
  readTryoutTrackSetList,
} from "@/components/tryout/route/catalog.server";
import { TrackListRequestSchema } from "@/components/tryout/route/search";
import { serverHandler } from "@/lib/server/fn";

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

/** The learner's set list of one track: its arguments and the page of rows. */
export type TryoutTrackListResult = Effect.Success<
  ReturnType<typeof readTryoutTrackSetList>
>;

/** The hub page of one locale, read on the server for a loader. */
export const readTryoutHubHandler = serverHandler(
  (data: typeof LocaleInput.Type) => readTryoutHubRoute(data.locale)
);

export const readTryoutHubFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(readTryoutHubHandler);

/** One country page, or the not-found decision when the catalog has none. */
export const readTryoutCountryHandler = serverHandler(
  (data: typeof CountryInput.Type) => readTryoutCountryRoute(data)
);

/** One country page, read on the server for a loader. */
export const readTryoutCountryFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CountryInput))
  .handler(readTryoutCountryHandler);

/** One exam page, or the not-found decision when the catalog has none. */
export const readTryoutExamHandler = serverHandler(
  (data: typeof ExamInput.Type) => readTryoutExamRoute(data)
);

/** One exam page, read on the server for a loader. */
export const readTryoutExamFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamInput))
  .handler(readTryoutExamHandler);

/** One track page, or the not-found decision when the catalog has none. */
export const readTryoutTrackHandler = serverHandler(
  (data: typeof TrackInput.Type) => readTryoutTrackRoute(data)
);

/** One track page, read on the server for a loader. */
export const readTryoutTrackFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackInput))
  .handler(readTryoutTrackHandler);

/** The learner's set list of one track, read per request and never cached. */
export const readTryoutTrackListHandler = serverHandler(
  (data: typeof TrackListRequestSchema.Type) => readTryoutTrackSetList(data)
);

/** The learner's set list of one track, read on the server for a loader. */
export const readTryoutTrackListFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackListRequestSchema))
  .handler(readTryoutTrackListHandler);
