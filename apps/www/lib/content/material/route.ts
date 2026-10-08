import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import {
  CorpusSourcePathSchema,
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ActiveAppLocaleListSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect, HashSet, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  decodeMaterialJson,
  isMaterialCounterpart,
  isMaterialSibling,
  makeMaterialProjectionError,
} from "@/lib/content/material/decode";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { httpLayer } from "@/lib/convex/http";

const PublishedMaterialIdentitySchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});
const PublishedMaterialRouteSchema = Schema.Union([
  Schema.Struct({
    ...PublishedMaterialIdentitySchema.fields,
    alternates: Schema.Tuple([]),
    projection: Schema.Null,
    rendererDomain: Schema.Null,
    siblings: Schema.Tuple([]),
    sourcePath: Schema.Null,
  }),
  Schema.Struct({
    ...PublishedMaterialIdentitySchema.fields,
    alternates: Schema.Array(MaterialLessonProjectionSchema),
    projection: MaterialLessonProjectionSchema,
    rendererDomain: RendererDomainSchema,
    siblings: Schema.Array(MaterialLessonProjectionSchema),
    sourcePath: CorpusSourcePathSchema,
  }),
]);

/** Complete immutable shell data for one signed material lesson or tombstone. */
export type PublishedMaterialRoute = typeof PublishedMaterialRouteSchema.Type;
/** Decodes the coherent active release identifiers carried by one route model. */
const decodeActiveIdentity = Effect.fn("NakafaMaterial.decodeActiveIdentity")(
  function* (
    activeManifestHash: null | string,
    activeReleaseId: null | string,
    expectedActiveReleaseId: ContentReleasePin | undefined,
    locale: Locale,
    publicPath: string
  ) {
    const releaseId = yield* decodeContentReleasePin(
      activeReleaseId,
      expectedActiveReleaseId,
      {
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      }
    );
    if (activeManifestHash === null || releaseId === null) {
      return yield* makeMaterialProjectionError({
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      });
    }
    const manifestHash = yield* Schema.decodeEffect(Sha256HashSchema)(
      activeManifestHash
    ).pipe(
      Effect.mapError(() =>
        makeMaterialProjectionError({
          appLocale: AppLocaleSchema.make(locale),
          publicPath,
        })
      )
    );
    return {
      activeManifestHash: manifestHash,
      activeReleaseId: releaseId,
    };
  }
);
/** Reads and validates one complete signed material route model. */
export const readPublishedMaterialRoute = Effect.fn(
  "NakafaMaterial.readPublishedRoute"
)(function* (
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(refs.public.contentRelease.material.publication, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : {
            expectedActiveReleaseId,
          }),
      appLocale,
      publicPath,
    })
  ).pipe(Effect.provide(httpLayer()));
  return yield* decodePublishedMaterialRoute(
    result,
    locale,
    publicPath,
    expectedActiveReleaseId
  );
});

/** Validates the route model delivered alone or with its signed public body. */
export const decodePublishedMaterialRoute = Effect.fn(
  "NakafaMaterial.decodePublishedRoute"
)(function* (
  result: Ref.Returns<typeof refs.public.contentRelease.material.publication>,
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const decodedActiveAppLocales = Schema.decodeUnknownEffect(
    ActiveAppLocaleListSchema
  )(result.activeAppLocales).pipe(
    Effect.mapError(() =>
      makeMaterialProjectionError({
        appLocale,
        publicPath,
      })
    )
  );
  const [active, activeAppLocales, sourceRevision] = yield* Effect.all([
    decodeActiveIdentity(
      result.activeManifestHash,
      result.activeReleaseId,
      expectedActiveReleaseId,
      locale,
      publicPath
    ),
    decodedActiveAppLocales,
    decodeSourceRevision(result.sourceRevision, {
      appLocale,
      publicPath,
    }),
  ]);
  if (result.projectionJson === null) {
    return {
      ...active,
      alternates: [],
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourcePath: null,
      sourceRevision,
    } satisfies PublishedMaterialRoute;
  }
  if (result.rendererDomain === null || result.sourcePath === null) {
    return yield* makeMaterialProjectionError({
      appLocale,
      publicPath,
    });
  }
  const projection = yield* decodeMaterialJson(result.projectionJson, {
    appLocale,
    publicPath,
  });
  const [alternates, rendererDomain, siblings, sourcePath] = yield* Effect.all([
    Effect.forEach(result.alternateJson, (source) =>
      decodeMaterialJson(source, {
        appLocale,
        publicPath,
      })
    ),
    Schema.decodeEffect(RendererDomainSchema)(result.rendererDomain),
    Effect.forEach(result.siblingJson, (source) =>
      decodeMaterialJson(source, {
        appLocale,
        publicPath,
      })
    ),
    Schema.decodeEffect(CorpusSourcePathSchema)(result.sourcePath),
  ]).pipe(
    Effect.mapError(() =>
      makeMaterialProjectionError({
        appLocale,
        publicPath,
      })
    )
  );
  const alternateLocales = HashSet.fromIterable(
    alternates.map((alternate) => alternate.appLocale)
  );
  const completeLocaleSet =
    HashSet.size(alternateLocales) === activeAppLocales.length &&
    activeAppLocales.every((alternateLocale) =>
      HashSet.has(alternateLocales, alternateLocale)
    );
  if (
    projection.appLocale !== appLocale ||
    projection.publicPath !== publicPath ||
    alternates.some(
      (alternate) => !isMaterialCounterpart(projection, alternate)
    ) ||
    HashSet.size(alternateLocales) !== alternates.length ||
    !alternates.some(
      (alternate) =>
        alternate.appLocale === projection.appLocale &&
        alternate.publicPath === projection.publicPath
    ) ||
    !completeLocaleSet ||
    siblings.some((sibling) => !isMaterialSibling(projection, sibling)) ||
    !siblings.some((sibling) => sibling.publicPath === projection.publicPath)
  ) {
    return yield* makeMaterialProjectionError({
      appLocale,
      publicPath,
    });
  }
  return {
    ...active,
    alternates,
    projection,
    rendererDomain,
    siblings,
    sourcePath,
    sourceRevision,
  } satisfies PublishedMaterialRoute;
});
