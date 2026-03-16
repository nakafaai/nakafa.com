export const ARTICLE_PATH_REGEX = /articles\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
export const BACKSLASH_REGEX = /\\/g;
export const BASE_PATH_REGEX =
  /export\s+const\s+BASE_PATH\s*=\s*["']([^"']+)["']/;
export const BASE_PATH_TEMPLATE_REGEX = /\$\{BASE_PATH\}/g;
export const CONST_CHOICES_REGEX = /const\s+choices[^=]*=\s*(\{[\s\S]*\})\s*;/;
export const DEFAULT_EXPORT_REGEX = /export\s+default\s+(\{[\s\S]*\})\s*;?\s*$/;
export const EXERCISE_MATERIAL_CONST_REGEX =
  /const\s+\w+Materials[^=]*=\s*(\[[\s\S]*?\])\s*as\s+const/;
export const EXERCISE_MATERIAL_PATH_REGEX =
  /exercises\/([^/]+)\/([^/]+)\/([^/]+)\/_data/;
export const EXERCISE_YEAR_SEGMENT_REGEX = /^\d{4}$/;
export const LAST_PATH_SEGMENT_REGEX = /\/([^/]+)$/;
export const LEADING_SLASH_REGEX = /^\//;
export const MDX_EXTENSION_REGEX = /\.mdx$/;
export const METADATA_REGEX = /export\s+const\s+metadata\s*=\s*(\{[\s\S]*?\});/;
export const MULTIPLE_NEWLINES_REGEX = /\n{3,}/g;
export const REFERENCES_REGEX =
  /export\s+const\s+references[^=]*=\s*(\[[\s\S]*?\]);?\s*$/;
export const SUBJECT_MATERIAL_CONST_REGEX =
  /const\s+\w+Materials[^=]*=\s*(\[[\s\S]*\])(?:\s*as\s+const)?;\s*export\s+default/;
export const SUBJECT_MATERIAL_PATH_REGEX =
  /subject\/([^/]+)\/([^/]+)\/([^/]+)\/_data/;
export const SUBJECT_PATH_REGEX =
  /subject\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/;
