import { HttpClient } from "@confect/js";
import "server-only";
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
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import {
  decodeCurriculumJson,
  decodeProgramJson,
} from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { httpLayer } from "@/lib/convex/http";

/** Reads and validates the bounded published program catalog. */
export const readPublishedProgramCatalog = Effect.fn(
  "NakafaProgram.readPublishedCatalog"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.program.catalog, {
      appLocale,
    })
  ).pipe(Effect.provide(httpLayer()));
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    appLocale,
    publicPath: "curricula",
  });
  if (!result.managed) {
    return yield* PublishedProjectionError.make({
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
        PublishedProjectionError.make({
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
export type PublishedProgramCatalog = typeof PublishedProgramCatalogSchema.Type;

/** Selects one renderable root from the authenticated bounded program catalog. */
export const readPublishedProgramPrerenderRoute = Effect.fn(
  "NakafaProgram.readPrerenderRoute"
)(function* (locale: Locale) {
  const catalog = yield* readPublishedProgramCatalog(locale);
  const entry = Arr.findFirst(catalog.entries, ({ route }) => route.sitemap);
  if (Option.isNone(entry)) {
    return yield* PublishedProjectionError.make({
      appLocale: AppLocaleSchema.make(locale),
      publicPath: "curricula",
    });
  }
  return entry.value.route;
});

/** Reads the authenticated featured subjects, one route per subject, for the About feature list. */
export const readPublishedProgramSubjects = Effect.fn(
  "NakafaProgram.readPublishedSubjects"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.program.subjects, {
      appLocale,
    })
  ).pipe(Effect.provide(httpLayer()));
  if (
    !result.managed ||
    result.routeJson.length > PROGRAM_FEATURED_SUBJECT_LIMIT
  ) {
    return yield* PublishedProjectionError.make({
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
        return yield* PublishedProjectionError.make({
          appLocale,
          publicPath: route.publicPath,
        });
      }
      return route;
    })
  );
});

/** Caches the featured subjects, one per subject, under current publication invalidation. */
export async function getPublishedProgramSubjects(locale: Locale) {
  "use cache";

  const subjects = await Effect.runPromise(
    readPublishedProgramSubjects(locale).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("program");
  return subjects;
}

/** Caches the bounded program catalog under program publication invalidation. */
export async function getPublishedProgramCatalog(locale: Locale) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedProgramCatalog(locale).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("program");
  return result;
}
