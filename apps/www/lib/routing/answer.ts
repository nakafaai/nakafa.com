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
