import "server-only";

import type { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
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
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Complete immutable data needed by one curriculum route page. */
export interface PublishedProgramRoute {
  readonly alternates: readonly PublishedCurriculumRoute[];
  readonly ancestors: readonly PublishedCurriculumRoute[];
  readonly children: readonly PublishedCurriculumRoute[];
  readonly contexts: readonly PublishedCurriculumRoute[];
  readonly groups: readonly PublishedCurriculumRoute[];
  readonly managed: boolean;
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
  const result = yield* readRuntimeQuery("contentRelease.program.route", () =>
    fetchRuntimeQuery(api.contentRelease.program.route, {
      locale,
      publicPath,
    })
  );
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    locale,
    publicPath,
  });
  if (!result.managed) {
    return {
      alternates: [],
      ancestors: [],
      children: [],
      contexts: [],
      groups: [],
      managed: false,
      materials: [],
      program: null,
      route: null,
      sourceRevision: null,
    } satisfies PublishedProgramRoute;
  }
  if (result.routeJson === null) {
    return {
      alternates: [],
      ancestors: [],
      children: [],
      contexts: [],
      groups: [],
      managed: true,
      materials: [],
      program: null,
      route: null,
      sourceRevision,
    } satisfies PublishedProgramRoute;
  }
  if (result.programJson === null) {
    return yield* new PublishedProjectionError({ locale, publicPath });
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
      decodeMaterialJson(source, { locale, publicPath })
    ),
    decodeProgramJson(result.programJson, locale, publicPath),
    decodeCurriculumJson(result.routeJson, locale, publicPath),
  ]);
  if (
    route.locale !== locale ||
    route.publicPath !== publicPath ||
    program.key !== route.programKey ||
    materials.some((material) => material.locale !== locale)
  ) {
    return yield* new PublishedProjectionError({ locale, publicPath });
  }
  return {
    alternates,
    ancestors,
    children,
    contexts,
    groups,
    managed: true,
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
