import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { env } from "@/env";
import "server-only";

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";

/** Reads one authenticated lesson to validate its Cache Components route. */
export const readPublishedMaterialPrerenderRoute = Effect.fn(
  "NakafaMaterial.readPrerenderRoute"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const identity = { appLocale, publicPath: "materials" };
  const result = yield* readNakafaRuntimeQuery(
    env.NEXT_PUBLIC_CONVEX_URL,
    api.contentRelease.material.publications,
    {
      appLocale,
      expectedManifestHash: null,
      expectedReleaseId: null,
      paginationOpts: { cursor: null, numItems: 1 },
    }
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
