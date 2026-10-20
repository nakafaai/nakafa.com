/**
 * Answers a request method that a route does not serve with 405 and the
 * methods it does serve. Without this handler the router
 * renders the document for that request.
 */
export function methodNotAllowed(allow: string) {
  return () => new Response(null, { headers: { Allow: allow }, status: 405 });
}
