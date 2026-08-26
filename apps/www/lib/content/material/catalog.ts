import "server-only";

import {
  type GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ActiveAppLocaleListSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type MaterialPageArgs = FunctionArgs<
  typeof api.contentRelease.material.publications
>;

/** Release identity required to continue one stable material catalog read. */
export interface MaterialPageCursor {
  readonly cursor: null | string;
  readonly expectedManifestHash: null | string;
  readonly expectedReleaseId: null | string;
}

/** Shared data returned by every bounded immutable material route page. */
interface PublishedMaterialPageBase {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly managed: boolean;
  readonly routes: readonly MaterialLessonProjection[];
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
  readonly stale: boolean;
}

/** One bounded immutable material route page with typed continuation state. */
export type PublishedMaterialPage = PublishedMaterialPageBase &
  (
    | {
        readonly done: true;
        readonly nextCursor: null;
      }
    | {
        readonly activeManifestHash: string;
        readonly activeReleaseId: string;
        readonly done: false;
        readonly nextCursor: string;
      }
  );

/** One complete localized catalog pinned to an authenticated release. */
export interface PublishedMaterialCatalog {
  readonly activeManifestHash: typeof Sha256HashSchema.Type;
  readonly activeReleaseId: typeof ReleaseIdSchema.Type;
  readonly appLocale: typeof AppLocaleSchema.Type;
  readonly routes: readonly MaterialLessonProjection[];
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Signed release identity shared by every localized material catalog. */
export interface PublishedMaterialRelease {
  readonly activeAppLocales: typeof ActiveAppLocaleListSchema.Type;
  readonly activeManifestHash: typeof Sha256HashSchema.Type;
  readonly activeReleaseId: typeof ReleaseIdSchema.Type;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Reads and decodes one release-bound page of material routes. */
export const readPublishedMaterialPage = Effect.fn(
  "NakafaMaterial.readPublishedPage"
)(function* (input: MaterialPageCursor & { readonly locale: Locale }) {
  const appLocale = AppLocaleSchema.make(input.locale);
  const args = {
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    appLocale,
    paginationOpts: {
      cursor: input.cursor,
      numItems: PROJECTION_PAGE_LIMIT,
    },
  } satisfies MaterialPageArgs;
  const result = yield* readRuntimeQuery(
    api.contentRelease.material.publications,
    args
  );
  const routes = yield* Effect.forEach(result.result.page, (source) =>
    decodeMaterialJson(source, {
      appLocale,
      publicPath: "materials",
    })
  );
  if (routes.some((route) => route.appLocale !== appLocale)) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "materials",
    });
  }
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    appLocale,
    publicPath: "materials",
  });
  const activeManifestHash = result.activeManifestHash;
  const activeReleaseId = result.activeReleaseId;
  const continueCursor = result.result.continueCursor;
  const isDone = result.result.isDone;
  const page = {
    activeManifestHash,
    activeReleaseId,
    managed: result.managed,
    routes,
    sourceRevision,
    stale: result.stale,
  };
  if (isDone) {
    return {
      ...page,
      done: true,
      nextCursor: null,
    } satisfies PublishedMaterialPage;
  }
  if (activeManifestHash === null || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: "materials",
    });
  }
  return {
    ...page,
    activeManifestHash,
    activeReleaseId,
    done: false,
    nextCursor: continueCursor,
  } satisfies PublishedMaterialPage;
});

/** Reads every bounded material page under one immutable release identity. */
export const readPublishedMaterialRoutes = Effect.fn(
  "NakafaMaterial.readPublishedRoutes"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const identity = { appLocale, publicPath: "materials" };
  const routes: MaterialLessonProjection[] = [];
  let cursor: MaterialPageCursor = {
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
  };
  let catalogIdentity: null | Pick<
    PublishedMaterialCatalog,
    "activeManifestHash" | "activeReleaseId" | "sourceRevision"
  > = null;
  while (true) {
    const page: PublishedMaterialPage = yield* readPublishedMaterialPage({
      ...cursor,
      locale,
    });
    if (page.stale) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "materials",
      });
    }
    if (!page.managed) {
      return yield* new PublishedProjectionError(identity);
    }
    if (page.activeManifestHash === null || page.activeReleaseId === null) {
      return yield* new PublishedProjectionError(identity);
    }
    const [activeManifestHash, activeReleaseId] = yield* Effect.all([
      Schema.decodeEffect(Sha256HashSchema)(page.activeManifestHash),
      Schema.decodeEffect(ReleaseIdSchema)(page.activeReleaseId),
    ]).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
    const pageIdentity = {
      activeManifestHash,
      activeReleaseId,
      sourceRevision: page.sourceRevision,
    };
    if (
      catalogIdentity !== null &&
      (catalogIdentity.activeManifestHash !== pageIdentity.activeManifestHash ||
        catalogIdentity.activeReleaseId !== pageIdentity.activeReleaseId ||
        catalogIdentity.sourceRevision !== pageIdentity.sourceRevision)
    ) {
      return yield* new PublishedProjectionError(identity);
    }
    catalogIdentity ??= pageIdentity;
    routes.push(...page.routes);
    if (page.done) {
      return {
        ...catalogIdentity,
        appLocale,
        routes,
      } satisfies PublishedMaterialCatalog;
    }
    cursor = {
      cursor: page.nextCursor,
      expectedManifestHash: page.activeManifestHash,
      expectedReleaseId: page.activeReleaseId,
    };
  }
});

/** Reads signed locale membership from one guaranteed material tombstone. */
export const readPublishedMaterialRelease = Effect.fn(
  "NakafaMaterial.readPublishedRelease"
)(function* () {
  const appLocale = AppLocaleSchema.make("en");
  const identity = { appLocale, publicPath: "materials" };
  const result = yield* readRuntimeQuery(
    api.contentRelease.material.publication,
    identity
  );
  if (result.activeManifestHash === null || result.activeReleaseId === null) {
    return yield* new PublishedProjectionError(identity);
  }
  const [
    activeAppLocales,
    activeManifestHash,
    activeReleaseId,
    sourceRevision,
  ] = yield* Effect.all([
    Schema.decodeUnknownEffect(ActiveAppLocaleListSchema)(
      result.activeAppLocales
    ),
    Schema.decodeEffect(Sha256HashSchema)(result.activeManifestHash),
    Schema.decodeEffect(ReleaseIdSchema)(result.activeReleaseId),
    decodeSourceRevision(result.sourceRevision, identity),
  ]).pipe(Effect.mapError(() => new PublishedProjectionError(identity)));
  return {
    activeAppLocales,
    activeManifestHash,
    activeReleaseId,
    sourceRevision,
  } satisfies PublishedMaterialRelease;
});

/** Caches all localized material routes under release invalidation. */
export async function getPublishedMaterialRoutes(locale: Locale) {
  "use cache";

  const result = await Effect.runPromise(readPublishedMaterialRoutes(locale));
  applyContentRuntimeCache();
  return result;
}

/** Caches signed material release membership under release invalidation. */
export async function getPublishedMaterialRelease() {
  "use cache";

  const result = await Effect.runPromise(readPublishedMaterialRelease());
  applyContentRuntimeCache();
  return result;
}
