import "server-only";

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { readMaterialPage } from "@repo/backend/content/material/page";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

/** Reads one authenticated lesson to validate its Cache Components route. */
export const readPublishedMaterialPrerenderRoute = Effect.fn(
  "NakafaMaterial.readPrerenderRoute"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const identity = { appLocale, publicPath: "materials" };
  const result = yield* readRuntimeQuery(
    api.contentRelease.material.publications,
    {
      appLocale,
      expectedManifestHash: null,
      expectedReleaseId: null,
      paginationOpts: { cursor: null, numItems: 1 },
    },
    (args) =>
      readMaterialPage(
        args.appLocale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
  );
  const source = result.result.page[0];
  if (
    !result.managed ||
    result.stale ||
    !Schema.is(Sha256HashSchema)(result.activeManifestHash) ||
    !Schema.is(ReleaseIdSchema)(result.activeReleaseId) ||
    source === undefined
  ) {
    return yield* new PublishedProjectionError(identity);
  }
  yield* decodeSourceRevision(result.sourceRevision, identity);
  const route = yield* decodeMaterialJson(source, identity);
  if (route.appLocale !== appLocale) {
    return yield* new PublishedProjectionError(identity);
  }
  return route;
});
