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
import {
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import { previewWireArtifact } from "@/test/content-preview";

/** Exact signed Page projection used by runtime adapter tests. */
export const testPageProjection = PublicPageProjectionSchema.make({
  appLocale: AppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  contentKey: ContentKeySchema.make("pages/terms-of-service"),
  kind: "public-page",
  metadata: {
    datePublished: "2026-08-21",
    description: "The terms that govern use of Nakafa.",
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
