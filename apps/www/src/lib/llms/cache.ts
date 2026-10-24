/**
 * The cache policy of the llms answers: the index, the skill guide and the Markdown
 * of a page. It is a constant only, so the Vite config can read it at build time.
 */
export const LLMS_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, must-revalidate";
