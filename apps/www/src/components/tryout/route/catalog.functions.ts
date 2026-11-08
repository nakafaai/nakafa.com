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

/** The address segments of a group page. */
const GroupInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  group: Schema.String,
  locale: LocaleSchema,
});

/** The address segments of a track page, and the catalog query of its set list. */
const TrackInput = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  group: Schema.String,
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

/** One group page, read on the server for a loader. */
export const readTryoutGroupFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(GroupInput))
  .handler(async (options) => {
    const { readTryoutGroupHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutGroupHandler(options);
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

/** A further window of one track's set list, as every visitor reads it. */
export const readTryoutTrackListFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(TrackListRequestSchema))
  .handler(async (options) => {
    const { readTryoutTrackListHandler } = await import(
      "@/components/tryout/route/catalog.server"
    );
    return readTryoutTrackListHandler(options);
  });
