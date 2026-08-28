import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type ActiveAppLocaleCode,
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizePublicPageProjection,
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import {
  insertRuntimeBinding,
  insertRuntimeKey,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";

export const TEST_PAGE_KEY = ContentKeySchema.make("pages/terms-of-service");
export const TEST_PAGE_PATH = PublicPathSchema.make("terms");
export const TEST_PAGE_SOURCE = CorpusSourcePathSchema.make(
  "packages/corpus/pages/terms/en.mdx"
);
export const TEST_PAGE_PROJECTION = PublicPageProjectionSchema.make({
  appLocale: AppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  contentKey: TEST_PAGE_KEY,
  kind: "public-page",
  metadata: {
    description: "Technical signed page fixture.",
    lastModified: "2026-08-20",
    title: "Terms of Service",
  },
  pageKey: PageKeySchema.make("terms-of-service"),
  publicPath: TEST_PAGE_PATH,
  sitemap: true,
  sourcePath: TEST_PAGE_SOURCE,
});
export const TEST_PAGE_PROJECTION_JSON =
  canonicalizePublicPageProjection(TEST_PAGE_PROJECTION);

/** Creates one locale-equivalent signed Page projection for backend tests. */
export function makeTestPageProjection(
  appLocale: ActiveAppLocaleCode,
  pageKey = "terms-of-service",
  publicPath = pageKey
) {
  return PublicPageProjectionSchema.make({
    ...TEST_PAGE_PROJECTION,
    appLocale: AppLocaleSchema.make(appLocale),
    artifactLocale: ArtifactLocaleSchema.make(appLocale),
    contentKey: ContentKeySchema.make(`pages/${pageKey}`),
    metadata: {
      ...TEST_PAGE_PROJECTION.metadata,
      title: `${pageKey} ${appLocale}`,
    },
    pageKey: PageKeySchema.make(pageKey),
    publicPath: PublicPathSchema.make(publicPath),
    sourcePath: CorpusSourcePathSchema.make(
      `packages/corpus/pages/${pageKey}/${appLocale}.mdx`
    ),
  });
}

/** Inserts one current Page head, route, and permanent identity. */
export async function insertTestPage(
  ctx: Parameters<typeof insertRuntimeKey>[0],
  appLocale: ActiveAppLocaleCode,
  pageKey = "terms-of-service",
  publicPath = pageKey,
  createdSequence = TEST_RUNTIME_RELEASE.sequence
) {
  const projection = makeTestPageProjection(appLocale, pageKey, publicPath);
  const projectionJson = canonicalizePublicPageProjection(projection);
  await insertRuntimeKey(ctx, projection.contentKey, {
    artifactLocale: projection.artifactLocale,
    headSequence: createdSequence,
    projectionJson,
  });
  await insertRuntimeVersion(ctx, "public", projection.contentKey, {
    artifactLocale: projection.artifactLocale,
    projectionJson,
    publicPath: projection.publicPath,
    rendererDomain: "site",
    sourcePath: projection.sourcePath,
  });
  await insertRuntimeBinding(ctx, projection.contentKey, {
    appLocale: projection.appLocale,
    publicPath: projection.publicPath,
  });
  return projectionJson;
}
