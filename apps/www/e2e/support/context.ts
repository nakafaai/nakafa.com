import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
} from "@playwright/test";
import type { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import { Effect } from "effect";

/**
 * Headed-Chrome identity without the automation markers.
 *
 * PostHog drops bot-flagged captures silently (`HeadlessChrome` UA/brands,
 * `navigator.webdriver`), which would zero out analytics suites. Versions
 * are cosmetic.
 *
 * References:
 * https://posthog.com/docs/libraries/js/config#opt_out_useragent_filter
 */
const REAL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Safari/537.36";

/** Client-hints brands mirroring the headed-Chrome user agent above. */
const REAL_USER_AGENT_BRANDS = [
  { brand: "Chromium", version: "153" },
  { brand: "Google Chrome", version: "153" },
  { brand: "Not-A.Brand", version: "8" },
];

/**
 * Adds a session cookie that the local acceptance runtime signed in, for the
 * address of one host, and lands it as a sign-in does. The attributes are those
 * of the session cookie that Better Auth sets: HttpOnly, and SameSite Lax.
 *
 * A sign-in ends on a page the Worker renders, and the Worker's answer sets the
 * signed-in hint that tells a static page to start its live session (`src/start.ts`).
 * Every public page is static since ADR 0038, so a browser that only held the
 * session cookie would stay a visitor there. One session read through the
 * context's own request client gets the Worker's answer, and the cookies it sets
 * stay with the browser.
 */
export const addSessionCookie = Effect.fn("NakafaE2E.addSessionCookie")(
  function* (
    context: BrowserContext,
    cookie: typeof SessionCookie.Type,
    url: string
  ) {
    yield* Effect.promise(() =>
      context.addCookies([
        {
          httpOnly: true,
          name: cookie.name,
          sameSite: "Lax",
          url,
          value: cookie.value,
        },
      ])
    );
    const session = new URL("/api/auth/get-session", url);
    const response = yield* Effect.promise(() =>
      context.request.get(session.href)
    );
    yield* Effect.sync(() =>
      expect(
        response.ok(),
        `${session.href} answered ${response.status()}`
      ).toBe(true)
    );
  }
);

/** Owns one isolated Playwright context for the complete use program. */
export const withBrowserContext = Effect.fn("NakafaE2E.withBrowserContext")(
  function* <A, E, R>(
    browser: Browser,
    options: BrowserContextOptions,
    use: (context: BrowserContext) => Effect.Effect<A, E, R>
  ) {
    return yield* Effect.acquireUseRelease(
      Effect.promise(async () => {
        const context = await browser.newContext({
          userAgent: REAL_USER_AGENT,
          ...options,
        });
        // Automation markers hidden so ingest behaves as in production.
        await context.addInitScript(
          ({ brands }: { brands: typeof REAL_USER_AGENT_BRANDS }) => {
            Object.defineProperty(navigator, "webdriver", {
              get: () => false,
            });
            Object.defineProperty(navigator, "userAgentData", {
              get: () => ({
                brands,
                mobile: false,
                platform: "macOS",
              }),
            });
          },
          { brands: REAL_USER_AGENT_BRANDS }
        );
        return context;
      }),
      use,
      (context) => Effect.promise(() => context[Symbol.asyncDispose]())
    );
  }
);
