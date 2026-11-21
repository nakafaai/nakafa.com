import { Array as Arr, Option } from "effect";

/** The attribute that `PlayerQuestion` sets on the article of a question to name it. */
const ARTICLE_ATTRIBUTE = "data-player-key";

/** Selects the articles of every question below a node. */
export const ARTICLES_SELECTOR = `[${ARTICLE_ATTRIBUTE}]`;

/** Reads the key of the question that an article belongs to. */
export function readArticleKey(element: Element) {
  return Option.fromNullishOr(element.getAttribute(ARTICLE_ATTRIBUTE));
}

/** Finds the article of one question below a node, or none when it is not mounted. */
export function findArticle(root: ParentNode | null, key: string) {
  if (root === null) {
    return Option.none();
  }
  return Arr.findFirst(
    Arr.fromIterable(root.querySelectorAll<HTMLElement>(ARTICLES_SELECTOR)),
    (article) =>
      Option.exists(readArticleKey(article), (found) => found === key)
  );
}

/**
 * Where a held question stands: the top of its article in the window, in pixels. A reflow that holds the reader's
 * place keeps it, whatever scroll the browser makes to get there, and a move of the page by the reader changes it.
 * A question that is not mounted stands where the page's scroll puts it, negated, so a scroll down moves it up as it
 * moves a question.
 */
export function readHoldPosition(root: ParentNode | null, key: string | null) {
  const article = key === null ? Option.none() : findArticle(root, key);
  return Option.match(article, {
    onNone: () => -window.scrollY,
    onSome: (found) => found.getBoundingClientRect().top,
  });
}
