import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";

/** The request header that carries the locale of a not-found page to the page that renders it. */
export const NEXT_INTL_LOCALE_HEADER = "x-next-intl-locale";

/** The route that renders the app's not-found page when the proxy rewrites a request to it. */
const CONTENT_NOT_FOUND_SEGMENT = "_not-found";

/**
 * Rewrites a request to the app's not-found page, with the status of the answer
 * (404 for a missing page, 410 for a retired one), the locale of the page, and a
 * noindex header. The Vary fields name the request headers that the answer
 * depends on, and they merge with the ones the response has. The rewrite names
 * the request URL (see `readVisitorUrl`).
 */
export function rewriteToNotFoundPage(
  request: NextRequest,
  locale: AppLocaleCode,
  vary: readonly string[],
  status: 404 | 410
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NEXT_INTL_LOCALE_HEADER, locale);

  const response = NextResponse.rewrite(
    new URL(`/${CONTENT_NOT_FOUND_SEGMENT}/${locale}`, request.url),
    {
      headers: {
        "X-Robots-Tag": "noindex",
      },
      request: {
        headers: requestHeaders,
      },
      status,
    }
  );
  response.headers.set(
    "Vary",
    mergeVaryHeader(Option.fromNullOr(response.headers.get("Vary")), vary)
  );
  return response;
}
