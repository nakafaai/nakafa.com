export const ARTICLE_PATH_REGEX = /articles\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
export const BACKSLASH_REGEX = /\\/g;
export const CONST_CHOICES_REGEX = /const\s+choices[^=]*=\s*(\{[\s\S]*\})\s*;/;
export const DEFAULT_EXPORT_REGEX = /export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/;
export const EXERCISE_YEAR_SEGMENT_REGEX = /^\d{4}$/;
export const LAST_PATH_SEGMENT_REGEX = /\/([^/]+)$/;
export const LEADING_SLASH_REGEX = /^\//;
export const MDX_EXTENSION_REGEX = /\.mdx$/;
export const METADATA_REGEX = /export\s+const\s+metadata\s*=\s*(\{[\s\S]*?\});/;
export const MULTIPLE_NEWLINES_REGEX = /\n{3,}/g;
export const REFERENCES_REGEX =
  /export\s+const\s+references[^=]*=\s*(\[[\s\S]*?\]);?\s*$/;
export const MATERIAL_LESSON_PATH_REGEX =
  /material\/lesson\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
