import { Effect } from "effect";

const markdownHeaders = {
  accept: "text/markdown,text/plain;q=0.9,text/html;q=0.1",
};
const htmlDocumentPattern = /^\s*(?:<!doctype html|<html|<head|<body)\b/i;
const markdownContentPattern = /(?:^|\n)#{1,6}\s+\S/;
const textContentTypes = ["markdown", "text/plain"];

/**
 * Fetches source-provided markdown when a page exposes a readable markdown form.
 */
export const fetchSourceMarkdown = Effect.fn("research.fetchSourceMarkdown")(
  function* (url: string) {
    for (const candidate of getMarkdownCandidates(url)) {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(candidate, {
            headers: markdownHeaders,
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          }),
        catch: () => undefined,
      }).pipe(
        Effect.match({
          onFailure: () => undefined,
          onSuccess: (result) => result,
        })
      );

      if (!response?.ok) {
        continue;
      }

      const content = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => "",
      }).pipe(
        Effect.match({
          onFailure: () => "",
          onSuccess: (text) => text,
        })
      );
      const text = content.trim();

      if (
        !isReadableMarkdown(text, response.headers.get("content-type") ?? "")
      ) {
        continue;
      }

      return text;
    }

    return;
  }
);

/**
 * Builds bounded markdown candidates from the user's exact source URL.
 */
function getMarkdownCandidates(url: string) {
  const source = new URL(url);
  const markdown = toMarkdownUrl(source);

  if (!markdown) {
    return [source.toString()];
  }

  return [source.toString(), markdown.toString()];
}

/**
 * Converts docs-style page URLs into their adjacent markdown URL.
 */
function toMarkdownUrl(source: URL) {
  if (source.pathname === "/" || source.pathname.endsWith(".md")) {
    return;
  }

  const url = new URL(source.toString());
  url.pathname = source.pathname.endsWith("/")
    ? `${source.pathname.slice(0, -1)}.md`
    : `${source.pathname}.md`;

  return url;
}

/**
 * Keeps source markdown while rejecting HTML fallbacks and empty responses.
 */
function isReadableMarkdown(content: string, contentType: string) {
  if (!content) {
    return false;
  }

  if (htmlDocumentPattern.test(content)) {
    return false;
  }

  if (contentType.includes("text/html")) {
    return false;
  }

  if (textContentTypes.some((type) => contentType.includes(type))) {
    return true;
  }

  return markdownContentPattern.test(content);
}
