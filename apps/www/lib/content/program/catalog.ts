import "server-only";

import type { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { ProgramTranslation } from "@nakafa/aksara-contracts/program/spec";
import { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  decodeCurriculumJson,
  decodeProgramJson,
  type PublishedCurriculumRoute,
  type PublishedLearningProgram,
} from "@/lib/content/program/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type ProgramPageArgs = FunctionArgs<typeof api.contentRelease.program.page>;

/** Active release identity required to continue one stable program read. */
interface ProgramCursor {
  readonly cursor: null | string;
  readonly expectedManifestHash: null | string;
  readonly expectedReleaseId: null | string;
}

/** Complete bounded program catalog used by root curriculum navigation. */
export interface PublishedProgramCatalog {
  readonly entries: readonly {
    readonly program: PublishedLearningProgram;
    readonly route: PublishedCurriculumRoute;
    readonly translation: ProgramTranslation;
  }[];
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** One bounded immutable curriculum-route page from Aksara. */
export interface PublishedProgramPage {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly done: boolean;
  readonly managed: boolean;
  readonly nextCursor: null | string;
  readonly routes: readonly PublishedCurriculumRoute[];
  readonly snapshotId: null | string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
  readonly stale: boolean;
}

/** Reads and validates the bounded published program catalog. */
export const readPublishedProgramCatalog = Effect.fn(
  "NakafaProgram.readPublishedCatalog"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(api.contentRelease.program.catalog, {
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

/** Reads and decodes one release-bound page of curriculum routes. */
export const readPublishedProgramPage = Effect.fn(
  "NakafaProgram.readPublishedPage"
)(function* (input: ProgramCursor & { readonly locale: Locale }) {
  const appLocale = AppLocaleSchema.make(input.locale);
  const args = {
    appLocale,
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    paginationOpts: {
      cursor: input.cursor,
      numItems: PROJECTION_PAGE_LIMIT,
    },
  } satisfies ProgramPageArgs;
  const result = yield* readRuntimeQuery(api.contentRelease.program.page, args);
  const routes = yield* Effect.forEach(result.result.page, (source) =>
    decodeCurriculumJson(source, input.locale, "curricula")
  );
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    appLocale,
    publicPath: "curricula",
  });
  const nextCursor = result.result.isDone ? null : result.result.continueCursor;
  return {
    activeManifestHash: result.activeManifestHash,
    activeReleaseId: result.activeReleaseId,
    done: result.result.isDone,
    managed: result.managed,
    nextCursor,
    routes,
    snapshotId: result.snapshotId,
    sourceRevision,
    stale: result.stale,
  } satisfies PublishedProgramPage;
});

/** Reads every bounded route page under one immutable release identity. */
export const readPublishedProgramRoutes = Effect.fn(
  "NakafaProgram.readPublishedRoutes"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const routes: PublishedCurriculumRoute[] = [];
  let cursor: ProgramCursor = {
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
  };
  let sourceRevision: null | string = null;
  while (true) {
    const page: PublishedProgramPage = yield* readPublishedProgramPage({
      ...cursor,
      locale,
    });
    if (page.stale) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "curricula",
      });
    }
    if (!page.managed) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "curricula",
      });
    }
    routes.push(...page.routes);
    sourceRevision = page.sourceRevision;
    if (page.done) {
      return { routes, sourceRevision };
    }
    if (
      page.nextCursor === null ||
      page.activeManifestHash === null ||
      page.activeReleaseId === null
    ) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "curricula",
      });
    }
    cursor = {
      cursor: page.nextCursor,
      expectedManifestHash: page.activeManifestHash,
      expectedReleaseId: page.activeReleaseId,
    };
  }
});

/** Caches every localized curriculum route under global release invalidation. */
export async function getPublishedProgramRoutes(locale: Locale) {
  "use cache";

  const result = await Effect.runPromise(readPublishedProgramRoutes(locale));
  applyContentRuntimeCache();
  return result;
}

/** Caches the bounded program catalog under global release invalidation. */
export async function getPublishedProgramCatalog(locale: Locale) {
  "use cache";

  const result = await Effect.runPromise(readPublishedProgramCatalog(locale));
  applyContentRuntimeCache();
  return result;
}
