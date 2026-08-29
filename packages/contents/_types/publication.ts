export const ARTICLE_PUBLICATION_CURSOR_PREFIX = "article-publication|";

/** Prefixes one current article-publication cursor with its stable identity. */
export function encodeArticlePublicationCursor(cursor: string) {
  return `${ARTICLE_PUBLICATION_CURSOR_PREFIX}${cursor}`;
}

/** Recognizes cursors that claim the stable article-publication format. */
export function hasArticlePublicationCursorPrefix(cursor: string) {
  return cursor.startsWith(ARTICLE_PUBLICATION_CURSOR_PREFIX);
}
