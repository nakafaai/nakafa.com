import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizePublicPageProjection,
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";

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
