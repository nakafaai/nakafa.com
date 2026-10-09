import { HttpClient } from "@confect/js";
import "server-only";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { decodeMaterialJson } from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { httpLayer } from "@/lib/convex/http";

/** Reads one authenticated lesson to validate its Cache Components route. */
export const readPublishedMaterialPrerenderRoute = Effect.fn(
  "NakafaMaterial.readPrerenderRoute"
)(function* (locale: Locale) {
  const appLocale = AppLocaleSchema.make(locale);
  const identity = {
    appLocale,
    publicPath: "materials",
  };
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.material.publications, {
      appLocale,
      expectedManifestHash: null,
      expectedReleaseId: null,
      paginationOpts: {
        cursor: null,
        numItems: 1,
      },
    })
  ).pipe(Effect.provide(httpLayer()));
  const source = result.result.page[0];
  if (
    !result.managed ||
    result.stale ||
    !Schema.is(Sha256HashSchema)(result.activeManifestHash) ||
    !Schema.is(ReleaseIdSchema)(result.activeReleaseId) ||
    source === undefined
  ) {
    return yield* PublishedProjectionError.make(identity);
  }
  yield* decodeSourceRevision(result.sourceRevision, identity);
  const route = yield* decodeMaterialJson(source, identity);
  if (route.appLocale !== appLocale) {
    return yield* PublishedProjectionError.make(identity);
  }
  return route;
});
