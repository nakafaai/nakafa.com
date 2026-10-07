import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";

const MARKDOWN_TIMEOUT = "5 seconds";
const markdownHeaders = {
  accept: "text/markdown,text/plain;q=0.9,text/html;q=0.1",
};
const htmlDocumentPattern = /^\s*(?:<!doctype html|<html|<head|<body)\b/i;
const markdownContentPattern = /(?:^|\n)#{1,6}\s+\S/;
const textContentTypes = ["markdown", "text/plain"];
/**
 * The Fetch client with redirects returned as they are: a source URL is
 * checked before it is fetched, so a redirect must never be followed to a
 * host nobody checked. Only the Fetch client honors that option.
 */
const MarkdownHttpClient = FetchClient.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" })
  )
);

/** Reads one candidate as trimmed markdown, or nothing when it is not markdown. */
const readMarkdownCandidate = Effect.fn("research.readMarkdownCandidate")(
  function* (candidate: string) {
    // The scope aborts the request, so a refused candidate never lingers unread.
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const response = yield* client
      .get(candidate, { headers: markdownHeaders })
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
    const text = (yield* response.text).trim();
    return isReadableMarkdown(text, response.headers["content-type"] ?? "")
      ? Option.some(text)
      : Option.none();
  },
  Effect.scoped
);

/**
 * Fetches source-provided markdown when a page exposes a readable markdown form.
 */
export const fetchSourceMarkdown = Effect.fn("research.fetchSourceMarkdown")(
  function* (url: string) {
    for (const candidate of getMarkdownCandidates(url)) {
      // A candidate that is unreachable, slow, or refused is skipped: the
      // caller reads the page another way when no candidate is markdown.
      const markdown = yield* readMarkdownCandidate(candidate).pipe(
        Effect.timeout(MARKDOWN_TIMEOUT),
        Effect.option,
        Effect.map(Option.flatten)
      );

      if (Option.isSome(markdown)) {
        return markdown.value;
      }
    }
  },
  Effect.provide(MarkdownHttpClient)
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

  if (Arr.some(textContentTypes, (type) => contentType.includes(type))) {
    return true;
  }

  return markdownContentPattern.test(content);
}
