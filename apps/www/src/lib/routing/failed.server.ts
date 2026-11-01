import { Effect } from "effect";
import { hasStaticRelease } from "@/lib/routing/release";
import { answerShell } from "@/lib/routing/shell.server";

/** The destination a browser names for a page it navigates to, as a tab shows it. */
const DOCUMENT = "document";

/** The type of Start's own error answer, which a browser would show as raw text. */
const JSON_TYPE = "application/json";

/**
 * Answers a page that the Worker failed to render with the release's browser shell, which draws the page
 * from the browser: the failure is usually a read that a busy backend dropped, and the router's error page
 * answers if it fails there too. Start's error answer is JSON for a client, and a learner's tab would show
 * it as the whole page. The router's own error page is HTML, so it stays, and a call that is no navigation
 * keeps Start's answer. A prerender and a development server bind no shell.
 */
export const answerFailedDocument = Effect.fn("www.routing.failedDocument")(
  function* (request: Request, response: Response) {
    if (
      response.status !== 500 ||
      request.headers.get("sec-fetch-dest") !== DOCUMENT ||
      !response.headers.get("content-type")?.includes(JSON_TYPE) ||
      !hasStaticRelease()
    ) {
      return response;
    }
    const page = yield* answerShell(request, 503);
    const headers = new Headers(page.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(page.body, { headers, status: page.status });
  }
);
