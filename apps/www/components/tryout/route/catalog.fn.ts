import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import type { Effect } from "effect";
import { Schema } from "effect";
import type { readTryoutTrackSetList } from "@/components/tryout/route/catalog.server";
import { TrackListRequestSchema } from "@/components/tryout/route/search";

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
export const readTryoutHubFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(LocaleInput))
  .handler(async (options) => {
    const { readTryoutHubHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutHubHandler(options);
  });

/** One country page, read on the server for a loader. */
export const readTryoutCountryFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(CountryInput))
  .handler(async (options) => {
    const { readTryoutCountryHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutCountryHandler(options);
  });

/** One exam page, read on the server for a loader. */
export const readTryoutExamFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamInput))
  .handler(async (options) => {
    const { readTryoutExamHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutExamHandler(options);
  });

/** One track page, read on the server for a loader. */
export const readTryoutTrackFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackInput))
  .handler(async (options) => {
    const { readTryoutTrackHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutTrackHandler(options);
  });

/** The learner's set list of one track, read on the server for a loader. */
export const readTryoutTrackListFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackListRequestSchema))
  .handler(async (options) => {
    const { readTryoutTrackListHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutTrackListHandler(options);
  });
