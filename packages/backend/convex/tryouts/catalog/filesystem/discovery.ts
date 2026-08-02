import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  toPublicTryoutCountry,
  toPublicTryoutExam,
  toPublicTryoutTrack,
} from "@repo/backend/convex/tryouts/queries/catalogModel";
import { Effect } from "effect";

const CATALOG_PAGE_LIMIT = 100;

interface CatalogPath {
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Reads the filesystem-owned country-first try-out hub. */
export const readFilesystemHub = Effect.fn("tryouts.catalog.readFilesystemHub")(
  function* (ctx: QueryCtx, locale: ContentLocale) {
    const countries = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCountries")
        .withIndex("by_locale_and_isActive_and_order", (query) =>
          query.eq("locale", locale).eq("isActive", true)
        )
        .take(CATALOG_PAGE_LIMIT)
    );
    const rows = yield* Effect.forEach(
      countries,
      (country) =>
        Effect.gen(function* () {
          const exams = yield* Effect.promise(() =>
            ctx.db
              .query("tryoutExams")
              .withIndex(
                "by_countryKey_and_locale_and_isActive_and_order",
                (query) =>
                  query
                    .eq("countryKey", country.countryKey)
                    .eq("locale", locale)
                    .eq("isActive", true)
              )
              .take(CATALOG_PAGE_LIMIT)
          );
          return {
            examCount: exams.length,
            ...toPublicTryoutCountry(country),
          };
        }),
      { concurrency: "unbounded" }
    );
    return { countries: rows };
  }
);

/** Reads one filesystem-owned country and its active exams. */
export const readFilesystemCountry = Effect.fn(
  "tryouts.catalog.readFilesystemCountry"
)(function* (ctx: QueryCtx, path: CatalogPath) {
  const country = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCountries")
      .withIndex("by_locale_and_publicPath", (query) =>
        query.eq("locale", path.locale).eq("publicPath", path.publicPath)
      )
      .unique()
  );
  if (!country?.isActive) {
    return null;
  }
  const exams = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutExams")
      .withIndex("by_countryKey_and_locale_and_isActive_and_order", (query) =>
        query
          .eq("countryKey", country.countryKey)
          .eq("locale", path.locale)
          .eq("isActive", true)
      )
      .take(CATALOG_PAGE_LIMIT)
  );
  return {
    country: toPublicTryoutCountry(country),
    exams: exams.map(toPublicTryoutExam),
  };
});

/** Reads one filesystem-owned exam and its ready tracks. */
export const readFilesystemExam = Effect.fn(
  "tryouts.catalog.readFilesystemExam"
)(function* (ctx: QueryCtx, path: CatalogPath) {
  const exam = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutExams")
      .withIndex("by_locale_and_publicPath", (query) =>
        query.eq("locale", path.locale).eq("publicPath", path.publicPath)
      )
      .unique()
  );
  if (!exam?.isActive) {
    return null;
  }
  const [country, tracks] = yield* Effect.all(
    [
      Effect.promise(() =>
        ctx.db
          .query("tryoutCountries")
          .withIndex("by_countryKey_and_locale", (query) =>
            query.eq("countryKey", exam.countryKey).eq("locale", path.locale)
          )
          .unique()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutTracks")
          .withIndex(
            "by_countryKey_and_examKey_and_locale_and_isActive_and_order",
            (query) =>
              query
                .eq("countryKey", exam.countryKey)
                .eq("examKey", exam.examKey)
                .eq("locale", path.locale)
                .eq("isActive", true)
          )
          .take(CATALOG_PAGE_LIMIT)
      ),
    ],
    { concurrency: "unbounded" }
  );
  if (!country?.isActive) {
    return null;
  }
  return {
    country: toPublicTryoutCountry(country),
    exam: toPublicTryoutExam(exam),
    tracks: tracks.filter(({ isReady }) => isReady).map(toPublicTryoutTrack),
  };
});

/** Reads one filesystem-owned ready track and its active parents. */
export const readFilesystemTrack = Effect.fn(
  "tryouts.catalog.readFilesystemTrack"
)(function* (ctx: QueryCtx, path: CatalogPath) {
  const track = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutTracks")
      .withIndex("by_locale_and_publicPath", (query) =>
        query.eq("locale", path.locale).eq("publicPath", path.publicPath)
      )
      .unique()
  );
  if (!(track?.isActive && track.isReady)) {
    return null;
  }
  const [country, exam] = yield* Effect.all(
    [
      Effect.promise(() =>
        ctx.db
          .query("tryoutCountries")
          .withIndex("by_countryKey_and_locale", (query) =>
            query.eq("countryKey", track.countryKey).eq("locale", path.locale)
          )
          .unique()
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutExams")
          .withIndex("by_countryKey_and_examKey_and_locale", (query) =>
            query
              .eq("countryKey", track.countryKey)
              .eq("examKey", track.examKey)
              .eq("locale", path.locale)
          )
          .unique()
      ),
    ],
    { concurrency: "unbounded" }
  );
  if (!(country?.isActive && exam?.isActive)) {
    return null;
  }
  return {
    country: toPublicTryoutCountry(country),
    exam: toPublicTryoutExam(exam),
    track: toPublicTryoutTrack(track),
  };
});
