import "server-only";

import type { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import type { MaterialProjectionWire } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type MaterialPageArgs = FunctionArgs<typeof api.contentRelease.material.page>;

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
  readonly routes: readonly MaterialProjectionWire[];
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

/** Reads and decodes one release-bound page of material routes. */
export const readPublishedMaterialPage = Effect.fn(
  "NakafaMaterial.readPublishedPage"
)(function* (input: MaterialPageCursor & { readonly locale: Locale }) {
  const args = {
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    locale: input.locale,
    paginationOpts: {
      cursor: input.cursor,
      numItems: PROJECTION_PAGE_LIMIT,
    },
  } satisfies MaterialPageArgs;
  const result = yield* readRuntimeQuery("contentRelease.material.page", () =>
    fetchRuntimeQuery(api.contentRelease.material.page, args)
  );
  const routes = yield* Effect.forEach(result.result.page, (source) =>
    decodeMaterialJson(source, {
      locale: input.locale,
      publicPath: "materials",
    })
  );
  if (routes.some((route) => route.locale !== input.locale)) {
    return yield* new PublishedProjectionError({
      locale: input.locale,
      publicPath: "materials",
    });
  }
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    locale: input.locale,
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
      locale: input.locale,
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
  const routes: MaterialProjectionWire[] = [];
  let cursor: MaterialPageCursor = {
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
  };
  let sourceRevision: null | typeof GitCommitShaSchema.Type = null;
  while (true) {
    const page: PublishedMaterialPage = yield* readPublishedMaterialPage({
      ...cursor,
      locale,
    });
    if (page.stale) {
      return yield* new PublishedProjectionError({
        locale,
        publicPath: "materials",
      });
    }
    if (!page.managed) {
      return { managed: false, routes: [], sourceRevision: null };
    }
    routes.push(...page.routes);
    sourceRevision = page.sourceRevision;
    if (page.done) {
      return { managed: true, routes, sourceRevision };
    }
    cursor = {
      cursor: page.nextCursor,
      expectedManifestHash: page.activeManifestHash,
      expectedReleaseId: page.activeReleaseId,
    };
  }
});

/** Caches all localized material routes under release invalidation. */
export async function getPublishedMaterialRoutes(locale: Locale) {
  "use cache";

  const result = await Effect.runPromise(readPublishedMaterialRoutes(locale));
  applyContentRuntimeCache();
  return result;
}
