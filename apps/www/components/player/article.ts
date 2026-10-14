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
