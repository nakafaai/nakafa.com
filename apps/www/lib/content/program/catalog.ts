import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { env } from "@/env";
import "server-only";

import type { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { ProgramTranslation } from "@nakafa/aksara-contracts/program/spec";
import { api } from "@repo/backend/convex/_generated/api";
import { PROGRAM_FEATURED_SUBJECT_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import {
  decodeCurriculumJson,
  decodeProgramJson,
  type PublishedCurriculumRoute,
  type PublishedLearningProgram,
} from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";

/** Complete bounded program catalog used by root curriculum navigation. */
export interface PublishedProgramCatalog {
  readonly entries: readonly {
    readonly program: PublishedLearningProgram;
    readonly route: PublishedCurriculumRoute;
    readonly translation: ProgramTranslation;
  }[];
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Reads and validates the bounded published program catalog. */
export const readPublishedProgramCatalog = Effect.fn(
  "NakafaProgram.readPublishedCatalog"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.contentRelease.program.catalog,
    {
      appLocale,
    }
  );
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
    const program = programs.find(({ key }) => key === route.programKey);
    const translation = program?.translations.find(
      (candidate) => candidate.appLocale === appLocale
    );
    if (
      route.appLocale !== appLocale ||
      route.level !== "track" ||
      !program ||
      !translation
    ) {
      return Effect.fail(
        new PublishedProjectionError({
          appLocale,
          publicPath: route.publicPath,
        })
      );
    }
    return Effect.succeed({ program, route, translation });
  });
  return {
    entries,
    sourceRevision,
  } satisfies PublishedProgramCatalog;
});

/** Selects one renderable root from the authenticated bounded program catalog. */
export const readPublishedProgramPrerenderRoute = Effect.fn(
  "NakafaProgram.readPrerenderRoute"
)(function* (locale: Locale) {
  const catalog = yield* readPublishedProgramCatalog(locale);
  const entry = catalog.entries.find(({ route }) => route.sitemap);
  if (!entry) {
    return yield* new PublishedProjectionError({
      appLocale: AppLocaleSchema.make(locale),
      publicPath: "curricula",
    });
  }
  return entry.route;
});

/** Reads only the authenticated public subjects needed by the About feature list. */
export const readPublishedProgramSubjects = Effect.fn(
  "NakafaProgram.readPublishedSubjects"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.contentRelease.program.subjects,
    { appLocale }
  );
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

/** Caches the fixed-size subject sample under current publication invalidation. */
export async function getPublishedProgramSubjects(locale: Locale) {
  "use cache";

  const subjects = await Effect.runPromise(
    readPublishedProgramSubjects(locale)
  );
  applyContentCache("program");
  return subjects;
}

/** Caches the bounded program catalog under program publication invalidation. */
export async function getPublishedProgramCatalog(locale: Locale) {
  "use cache";

  const result = await Effect.runPromise(readPublishedProgramCatalog(locale));
  applyContentCache("program");
  return result;
}
