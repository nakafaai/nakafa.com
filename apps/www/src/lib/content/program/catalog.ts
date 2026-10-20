import "@tanstack/react-start/server-only";
import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import {
  LearningProgramSchema,
  ProgramTranslationSchema,
} from "@nakafa/aksara-contracts/program/spec";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { PROGRAM_FEATURED_SUBJECT_LIMIT } from "@repo/backend/confect/contentRelease/program/limits";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import {
  decodeCurriculumJson,
  decodeProgramJson,
} from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { queryContentStore } from "@/lib/content/store/query";

/**
 * Reads and validates the bounded published program catalog. The content store
 * holds the query result once for each release and locale.
 */
export const readPublishedProgramCatalog = Effect.fn(
  "NakafaProgram.readPublishedCatalog"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryContentStore(contentRelease.program.catalog, {
    appLocale,
  });
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    appLocale,
    publicPath: "curricula",
  });
  if (!result.managed) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "curricula",
    });
  }
  const [programs, routes] = yield* Effect.all([
    Effect.forEach(result.programJson, (source) =>
      decodeProgramJson(source, locale, "curricula")
    ),
    Effect.forEach(result.routeJson, (source) =>
      decodeCurriculumJson(source, locale, "curricula")
    ),
  ]);
  const entries = yield* Effect.forEach(routes, (route) => {
    const program = Arr.findFirst(
      programs,
      ({ key }) => key === route.programKey
    );
    const translation = Option.flatMap(program, (found) =>
      Arr.findFirst(
        found.translations,
        (candidate) => candidate.appLocale === appLocale
      )
    );
    if (
      route.appLocale !== appLocale ||
      route.level !== "track" ||
      Option.isNone(program) ||
      Option.isNone(translation)
    ) {
      return Effect.fail(
        new PublishedProjectionError({
          appLocale,
          publicPath: route.publicPath,
        })
      );
    }
    return Effect.succeed({
      program: program.value,
      route,
      translation: translation.value,
    });
  });
  return {
    entries,
    sourceRevision,
  } satisfies PublishedProgramCatalog;
});

/** Decoded projection of the bounded program catalog, as root navigation consumes it. */
const PublishedProgramCatalogSchema = Schema.Struct({
  entries: Schema.Array(
    Schema.Struct({
      program: LearningProgramSchema,
      route: CurriculumRouteSchema,
      translation: ProgramTranslationSchema,
    })
  ),
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});

/** Complete bounded program catalog used by root curriculum navigation. */
type PublishedProgramCatalog = typeof PublishedProgramCatalogSchema.Type;

/** Selects one renderable root from the authenticated bounded program catalog. */
export const readPublishedProgramPrerenderRoute = Effect.fn(
  "NakafaProgram.readPrerenderRoute"
)(function* (locale: Locale) {
  const catalog = yield* readPublishedProgramCatalog(locale);
  const entry = Arr.findFirst(catalog.entries, ({ route }) => route.sitemap);
  if (Option.isNone(entry)) {
    return yield* new PublishedProjectionError({
      appLocale: AppLocaleSchema.make(locale),
      publicPath: "curricula",
    });
  }
  return entry.value.route;
});

/**
 * Reads the authenticated featured subjects, one route per subject, for the
 * About feature list. The content store holds the query result once for each
 * release and locale.
 */
export const readPublishedProgramSubjects = Effect.fn(
  "NakafaProgram.readPublishedSubjects"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryContentStore(contentRelease.program.subjects, {
    appLocale,
  });
  if (
    !result.managed ||
    result.routeJson.length > PROGRAM_FEATURED_SUBJECT_LIMIT
  ) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "curricula",
    });
  }
  return yield* Effect.forEach(result.routeJson, (source) =>
    Effect.gen(function* () {
      const route = yield* decodeCurriculumJson(source, locale, "curricula");
      if (
        route.appLocale !== appLocale ||
        route.level !== "subject" ||
        !route.sitemap
      ) {
        return yield* new PublishedProjectionError({
          appLocale,
          publicPath: route.publicPath,
        });
      }
      return route;
    })
  );
});

/**
 * Reads the featured subjects, one per subject, for the active release.
 */
export async function getPublishedProgramSubjects(locale: Locale) {
  const subjects = await Effect.runPromise(
    readPublishedProgramSubjects(locale)
  );
  return subjects;
}

/**
 * Reads the bounded program catalog for the active release.
 */
export async function getPublishedProgramCatalog(locale: Locale) {
  const result = await Effect.runPromise(readPublishedProgramCatalog(locale));
  return result;
}
