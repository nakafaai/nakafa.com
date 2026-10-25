import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { CatalogQuery } from "@/components/tryout/catalog/table/query";
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

/** The address segments of a track page, and the catalog query of its set list. */
const TrackInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: LocaleSchema,
  search: CatalogQuery,
  track: Schema.String,
});

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

/** One track page with the first page of its set list, read on the server for a loader. */
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
