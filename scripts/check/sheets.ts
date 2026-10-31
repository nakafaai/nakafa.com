import { Array as Arr } from "effect";

/**
 * A selector whose first compound names the document's root and holds `:has()`.
 * Every element of the page descends from the root, so each node that the page
 * inserts makes the browser restyle the whole document: on a phone, one such rule
 * held the main thread for seconds during hydration. Such a state lives in an
 * attribute that the root carries instead.
 */
const ROOT_HAS_PATTERN = /(?:^|[\s,}])(?:html|body|:root)[^\s,{]*:has\(/gmu;

const ROOT_HAS_RULE =
  "name the state in an attribute on the root instead of :has() on html, body or :root, which restyles the whole document on every insert";

/** Reports each selector of a stylesheet that anchors `:has()` on the document's root. */
export function inspectStylesheet(file: string, sourceText: string) {
  return Arr.map(
    Arr.fromIterable(sourceText.matchAll(ROOT_HAS_PATTERN)),
    () => `${file}: ${ROOT_HAS_RULE}.`
  );
}
