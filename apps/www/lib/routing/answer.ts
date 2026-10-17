/**
 * Answers in plain text that search engines must not index, such as a retired
 * or unknown resource.
 */
export function plainTextAnswer(status: 404 | 410, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
    status,
  });
}

/** The request header that carries the locale of a not-found page to the page that renders it. */
export const NEXT_INTL_LOCALE_HEADER = "x-next-intl-locale";

/** The route that renders the app's not-found page when the proxy rewrites a request to it. */
export const CONTENT_NOT_FOUND_SEGMENT = "_not-found";
