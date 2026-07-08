import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { ContentMetadata } from "@repo/contents/_types/content";
import type { ArticleCategory, Material } from "@repo/contents/_types/taxonomy";

/** Parsed MDX file with extracted metadata and content hash for change detection. */
export interface ParsedMdx {
  body: string;
  contentHash: string;
  metadata: ContentMetadata;
}

/** Parsed path info for article files: articles/{category}/{articleSlug}/{locale}.mdx. */
export interface ArticleParsedPath {
  articleSlug: string;
  category: ArticleCategory;
  locale: Locale;
  slug: string;
  type: "article";
}

/** Parsed path info for lesson material files. */
export interface MaterialLessonParsedPath {
  locale: Locale;
  material: Material;
  section: string;
  slug: string;
  topic: string;
  type: "material-lesson";
}
