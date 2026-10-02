import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const readinessTimeoutMilliseconds = 15_000;
/** Marks the first page heading the browser parses from the server HTML. */
const serverHeadingAttribute = "data-server-heading";

/** Content pages whose body streams in after the app shell. */
const contentPages = [
  { href: pinnedRoutes.material.id, name: "lesson", warm: "/en" },
  { href: pinnedRoutes.article.en, name: "article", warm: "/id" },
  { href: "/en/quran/2", name: "surah", warm: "/id" },
] as const;

/**
 * Opens a cached content page as a returning reader does: the app's scripts
 * are cached, so the page hydrates while its streamed body is still being
 * revealed, and the signed-out session answers at once. The session update
 * re-renders the providers above the body, and the reader must keep the body
 * the server rendered instead of one React discards and renders again.
 */
const verifyServerBodyKept = Effect.fn("NakafaE2E.verifyServerBodyKept")(
  function* (page: Page, content: (typeof contentPages)[number]) {
    yield* seedDeniedAnalyticsConsent(page);
    yield* Effect.promise(() =>
      page.addInitScript((attribute) => {
        let marked = false;
        new MutationObserver(() => {
          const heading = document.querySelector("h1");
          if (marked || !heading) {
            return;
          }
          heading.setAttribute(attribute, "");
          marked = true;
        }).observe(document, { childList: true, subtree: true });
      }, serverHeadingAttribute)
    );
    yield* Effect.promise(() =>
      page.route("**/api/auth/get-session**", (route) =>
        route.fulfill({ json: null })
      )
    );

    // A page's first request renders it on demand; this test covers the cached
    // page that later readers receive.
    yield* Effect.promise(() => page.request.get(content.href));
    yield* Effect.promise(() => page.goto(content.warm));
    yield* waitForCommittedAppRouter(
      page,
      content.warm,
      content.warm,
      readinessTimeoutMilliseconds
    );
    yield* Effect.promise(() =>
      page.goto(content.href, { waitUntil: "commit" })
    );
    yield* waitForCommittedAppRouter(
      page,
      content.href,
      content.href,
      readinessTimeoutMilliseconds
    );
    yield* Effect.promise(() => page.waitForLoadState("networkidle"));
    const headings = yield* Effect.promise(() =>
      page
        .locator("h1")
        .evaluateAll(
          (elements, attribute) =>
            elements.map((element) => element.hasAttribute(attribute)),
          serverHeadingAttribute
        )
    );
    yield* Effect.sync(() => expect(headings).toEqual([true]));
  }
);

test.describe("Streamed content", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  for (const content of contentPages) {
    test(`keeps the server-rendered ${content.name} through hydration`, async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyServerBodyKept(page, content))
      );
    });
  }
});
