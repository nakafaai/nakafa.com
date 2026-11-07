import { env } from "cloudflare:workers";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  HttpMediaTypeSchema,
  mergeVaryHeader,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Effect, Option } from "effect";
import { LLMS_MARKDOWN_MEDIA_TYPE } from "@/lib/llms/routes";

const HTML_MEDIA_TYPE = HttpMediaTypeSchema.make("text/html");

/** HTML comes first, so a tie, a wildcard or a request without Accept keeps HTML. */
const DOCUMENT_MEDIA_TYPES = [
  HTML_MEDIA_TYPE,
  LLMS_MARKDOWN_MEDIA_TYPE,
] as const;

/** The request field that the answers of this module depend on, beside the ones they already name. */
const ACCEPT_VARY = ["Accept"];

/** What an agent reads at an address that names no page: where every page is listed. */
const NOT_FOUND_MARKDOWN = `# Page not found

This address names no Nakafa page. Every lesson, article, Quran page and try-out is listed with its Markdown address in [llms.txt](${SITE_ORIGIN}/llms.txt), and [the sitemap](${SITE_ORIGIN}/sitemap.xml) lists every page.
`;

/** Whether a read asks for Markdown before HTML. */
function prefersMarkdown(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  const accept = Option.fromNullishOr(request.headers.get("accept"));
  return Option.contains(
    negotiateMediaType(accept, DOCUMENT_MEDIA_TYPES),
    LLMS_MARKDOWN_MEDIA_TYPE
  );
}

/** The headers of an answer that also depends on the Accept field. */
function withAcceptVary(headers: Headers) {
  headers.set(
    "vary",
    mergeVaryHeader(Option.fromNullishOr(headers.get("vary")), ACCEPT_VARY)
  );
  return headers;
}

/** The same answer, which now says that it depends on the Accept field. */
function varyByAccept(response: Response) {
  return new Response(response.body, {
    headers: withAcceptVary(new Headers(response.headers)),
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Answers the main site's root, which has no page of its own. A browser moves to
 * the negotiated locale with `redirect`. An agent that asks for Markdown reads that
 * locale home's twin at the root itself, the one the build wrote beside its HTML,
 * so the root negotiates without a page render. The root is a Worker address
 * already, so this costs no request that the assets would have answered.
 */
export const answerRootDocument = Effect.fn("www.llms.rootDocument")(function* (
  request: Request,
  redirect: Response
) {
  if (!prefersMarkdown(request)) {
    return varyByAccept(redirect);
  }
  const twinPath = `/${negotiateLocale(request.headers)}.md`;
  const twin = yield* Effect.promise(() =>
    env.ASSETS.fetch(new Request(new URL(twinPath, request.url)))
  );
  if (!twin.ok) {
    return varyByAccept(redirect);
  }
  const headers = new Headers(twin.headers);
  headers.set("content-location", twinPath);
  headers.set("content-type", LLMS_MARKDOWN_MEDIA_TYPE);
  headers.set(
    "vary",
    mergeVaryHeader(
      Option.fromNullishOr(redirect.headers.get("vary")),
      ACCEPT_VARY
    )
  );
  return new Response(twin.body, { headers, status: 200 });
});

/**
 * Answers a not-found answer in the representation the request asks for. An
 * agent that asks for Markdown reads a short Markdown page that names where every
 * page is listed, with the same 404, and every other request keeps the HTML page.
 * Either answer says that it depends on the Accept field.
 */
export const answerNotFoundDocument = Effect.fn("www.llms.notFoundDocument")(
  function* (request: Request, response: Response) {
    if (response.status !== 404) {
      return response;
    }
    if (!prefersMarkdown(request)) {
      return varyByAccept(response);
    }
    yield* Effect.promise(() => response.body?.cancel() ?? Promise.resolve());
    const headers = withAcceptVary(new Headers(response.headers));
    headers.delete("content-length");
    headers.delete("etag");
    headers.set("cache-control", "no-store");
    headers.set("content-type", LLMS_MARKDOWN_MEDIA_TYPE);
    return new Response(NOT_FOUND_MARKDOWN, { headers, status: 404 });
  }
);
