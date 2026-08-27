export const ARTICLE_PUBLICATION_CURSOR_PREFIX = "article-publication:v1:";

/** Prefixes one current article-publication cursor with its wire version. */
export function encodeArticlePublicationCursor(cursor: string) {
  return `${ARTICLE_PUBLICATION_CURSOR_PREFIX}${cursor}`;
}

/** Recognizes cursors that claim the current article-publication wire format. */
export function hasArticlePublicationCursorPrefix(cursor: string) {
  return cursor.startsWith(ARTICLE_PUBLICATION_CURSOR_PREFIX);
}
