import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { PagePreviewDocumentSchema } from "@nakafa/aksara-contracts/preview/document";
import {
  LOCAL_PREVIEW_FORMAT,
  PreviewPendingSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import {
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import {
  previewRepositories,
  previewWireArtifact,
} from "@/test/content-preview";

/** Exact signed Page projection used by runtime adapter tests. */
export const testPageProjection = PublicPageProjectionSchema.make({
  appLocale: AppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  contentKey: ContentKeySchema.make("pages/terms-of-service"),
  kind: "public-page",
  metadata: {
    description: "The terms that govern use of Nakafa.",
    lastModified: "2026-08-21",
    title: "Terms of Service",
  },
  pageKey: PageKeySchema.make("terms-of-service"),
  publicPath: PublicPathSchema.make("terms-of-service"),
  sitemap: true,
  sourcePath: CorpusSourcePathSchema.make("packages/corpus/pages/terms/en.mdx"),
});

/** Signed-wire shape used after cryptographic execution is mocked. */
export const testPageArtifact = SignedContentArtifactSchema.make({
  ...previewWireArtifact,
  payload: {
    ...previewWireArtifact.payload,
    contentKey: testPageProjection.contentKey,
    rawMdx: "# Terms of Service\n\nUse Nakafa responsibly.",
    rendererDomain: "site",
  },
});

/** Exact reviewed Page selected by local preview tests. */
export const testPagePreviewDocument = PagePreviewDocumentSchema.make({
  delivery: "public",
  family: "page",
  rendererDomain: "site",
  route: {
    appLocale: testPageProjection.appLocale,
    artifactLocale: testPageProjection.artifactLocale,
    contentKey: testPageProjection.contentKey,
    pageKey: testPageProjection.pageKey,
    publicPath: testPageProjection.publicPath,
  },
  sourcePath: testPageProjection.sourcePath,
});

/** Pending state for one real Page that other routes must ignore. */
export const testPagePendingManifest = PreviewPendingSchema.make({
  document: testPagePreviewDocument,
  format: LOCAL_PREVIEW_FORMAT,
  repositories: previewRepositories,
  revision: 1,
  status: "pending",
});
