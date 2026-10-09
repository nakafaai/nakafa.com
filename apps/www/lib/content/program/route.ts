import { HttpClient } from "@confect/js";
import "server-only";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { LearningProgramSchema } from "@nakafa/aksara-contracts/program/spec";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import {
  decodeCurriculumJson,
  decodeProgramJson,
} from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { httpLayer } from "@/lib/convex/http";

/** Decodes one array of immutable curriculum rows from the runtime query. */
const decodeRoutes = Effect.fn("NakafaProgram.decodeRoutes")(function* (
  sources: readonly string[],
  locale: Locale,
  publicPath: string
) {
  return yield* Effect.forEach(sources, (source) =>
    decodeCurriculumJson(source, locale, publicPath)
  );
});
/** Reads and validates one complete published curriculum route model. */
export const readPublishedProgramRoute = Effect.fn(
  "NakafaProgram.readPublishedRoute"
)(function* (locale: Locale, publicPath: string) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.program.route, {
      appLocale,
      publicPath,
    })
  ).pipe(Effect.provide(httpLayer()));
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    appLocale,
    publicPath,
  });
  const activeReleaseId = yield* Schema.decodeEffect(
    Schema.NullOr(ReleaseIdSchema)
  )(result.activeReleaseId).pipe(
    Effect.mapError(() =>
      PublishedProjectionError.make({
        appLocale,
        publicPath,
      })
    )
  );
  if (!result.managed) {
    return yield* PublishedProjectionError.make({
      appLocale,
      publicPath,
    });
  }
  if (activeReleaseId === null) {
    return yield* PublishedProjectionError.make({
      appLocale,
      publicPath,
    });
  }
  if (result.routeJson === null) {
    return {
      activeReleaseId,
      alternates: [],
      ancestors: [],
      children: [],
      contexts: [],
      groups: [],
      materials: [],
      program: null,
      route: null,
      sourceRevision,
    } satisfies PublishedProgramRoute;
  }
  if (result.programJson === null) {
    return yield* PublishedProjectionError.make({
      appLocale,
      publicPath,
    });
  }
  const [
    alternates,
    ancestors,
    children,
    contexts,
    groups,
    materials,
    program,
    route,
  ] = yield* Effect.all([
    decodeRoutes(result.alternateJson, locale, publicPath),
    decodeRoutes(result.ancestorJson, locale, publicPath),
    decodeRoutes(result.childJson, locale, publicPath),
    decodeRoutes(result.contextJson, locale, publicPath),
    decodeRoutes(result.groupJson, locale, publicPath),
    Effect.forEach(result.materialJson, (source) =>
      decodeMaterialJson(source, {
        appLocale,
        publicPath,
      })
    ),
    decodeProgramJson(result.programJson, locale, publicPath),
    decodeCurriculumJson(result.routeJson, locale, publicPath),
  ]);
  if (
    route.appLocale !== appLocale ||
    route.publicPath !== publicPath ||
    program.key !== route.programKey ||
    Arr.some(materials, (material) => material.appLocale !== appLocale)
  ) {
    return yield* PublishedProjectionError.make({
      appLocale,
      publicPath,
    });
  }
  return {
    activeReleaseId,
    alternates,
    ancestors,
    children,
    contexts,
    groups,
    materials,
    program,
    route,
    sourceRevision,
  } satisfies PublishedProgramRoute;
});

/** Decoded projection of one curriculum route page, as the page consumes it. */
const PublishedProgramRouteSchema = Schema.Struct({
  activeReleaseId: Schema.NullOr(ReleaseIdSchema),
  alternates: Schema.Array(CurriculumRouteSchema),
  ancestors: Schema.Array(CurriculumRouteSchema),
  children: Schema.Array(CurriculumRouteSchema),
  contexts: Schema.Array(CurriculumRouteSchema),
  groups: Schema.Array(CurriculumRouteSchema),
  materials: Schema.Array(MaterialLessonProjectionSchema),
  program: Schema.NullOr(LearningProgramSchema),
  route: Schema.NullOr(CurriculumRouteSchema),
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});

/** Complete immutable data needed by one curriculum route page. */
export type PublishedProgramRoute = typeof PublishedProgramRouteSchema.Type;

/** Caches one complete curriculum route under program publication invalidation. */
export async function getPublishedProgramRoute(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedProgramRoute(locale, publicPath).pipe(
      Effect.withTracerTiming(false)
    )
  );
  applyContentCache("program", "material");
  return result;
}
