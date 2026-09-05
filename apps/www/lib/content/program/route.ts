import "server-only";
import {
  type GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { readProgramRoute } from "@repo/backend/content/program/route";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import {
  decodeCurriculumJson,
  decodeProgramJson,
  type PublishedCurriculumRoute,
  type PublishedLearningProgram,
} from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { readRuntimeQuery } from "@/lib/content/runtime/query";
/** Complete immutable data needed by one curriculum route page. */
export interface PublishedProgramRoute {
  readonly activeReleaseId: null | typeof ReleaseIdSchema.Type;
  readonly alternates: readonly PublishedCurriculumRoute[];
  readonly ancestors: readonly PublishedCurriculumRoute[];
  readonly children: readonly PublishedCurriculumRoute[];
  readonly contexts: readonly PublishedCurriculumRoute[];
  readonly groups: readonly PublishedCurriculumRoute[];
  readonly materials: readonly MaterialLessonProjection[];
  readonly program: null | PublishedLearningProgram;
  readonly route: null | PublishedCurriculumRoute;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}
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
  const result = yield* readRuntimeQuery(
    api.contentRelease.program.route,
    {
      appLocale,
      publicPath,
    },
    (queryArgs) => readProgramRoute(queryArgs.appLocale, queryArgs.publicPath)
  );
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    appLocale,
    publicPath,
  });
  const activeReleaseId = yield* Schema.decodeEffect(
    Schema.NullOr(ReleaseIdSchema)
  )(result.activeReleaseId).pipe(
    Effect.mapError(
      () => new PublishedProjectionError({ appLocale, publicPath })
    )
  );
  if (!result.managed) {
    return yield* new PublishedProjectionError({ appLocale, publicPath });
  }
  if (activeReleaseId === null) {
    return yield* new PublishedProjectionError({ appLocale, publicPath });
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
    return yield* new PublishedProjectionError({ appLocale, publicPath });
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
      decodeMaterialJson(source, { appLocale, publicPath })
    ),
    decodeProgramJson(result.programJson, locale, publicPath),
    decodeCurriculumJson(result.routeJson, locale, publicPath),
  ]);
  if (
    route.appLocale !== appLocale ||
    route.publicPath !== publicPath ||
    program.key !== route.programKey ||
    materials.some((material) => material.appLocale !== appLocale)
  ) {
    return yield* new PublishedProjectionError({ appLocale, publicPath });
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
/** Caches one complete curriculum route under global release invalidation. */
export async function getPublishedProgramRoute(
  locale: Locale,
  publicPath: string
) {
  "use cache";
  const result = await Effect.runPromise(
    readPublishedProgramRoute(locale, publicPath)
  );
  applyContentRuntimeCache();
  return result;
}
