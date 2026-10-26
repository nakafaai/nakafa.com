import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableRef } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { KNOWN_SESSION_KEY } from "@/lib/auth/keys";

declare global {
  interface Window {
    nakafaServerContent?: {
      article: Element | null;
      heading: Element | null;
    };
  }
}

/** The child sitemaps that the sitemap index lists, by their path. */
const SITEMAP = /<loc>https:\/\/nakafa\.com(\/sitemap\/[^<]+\.xml)<\/loc>/gu;

/**
 * The English lessons and articles the sitemaps publish, article category pages
 * left out, and how many of each one run opens. Each family's pages split over
 * as many sitemap files as it needs.
 */
const families = [
  {
    count: 2,
    location: /<loc>https:\/\/nakafa\.com(\/en\/subjects\/[^<]+)<\/loc>/gu,
    sitemap: /^\/sitemap\/material_en_p\d+\.xml$/u,
  },
  {
    count: 1,
    location:
      /<loc>https:\/\/nakafa\.com(\/en\/articles\/[^/<]+\/[^/<]+)<\/loc>/gu,
    sitemap: /^\/sitemap\/article_en_p\d+\.xml$/u,
  },
] as const;

/**
 * Each run opens its own slice of each family, signed in and signed out, on a
 * phone and on a desktop. A family with fewer pages than the runs ask for
 * wraps around, so a small corpus still gives every run its pages.
 */
const runs = [
  { signedIn: false, slot: 0, viewport: { height: 844, width: 390 } },
  { signedIn: true, slot: 1, viewport: { height: 844, width: 390 } },
  { signedIn: false, slot: 2, viewport: { height: 900, width: 1440 } },
  { signedIn: true, slot: 3, viewport: { height: 900, width: 1440 } },
] as const;

const CONVEX_TOKEN_PATH = "/api/auth/convex/token";
// Settling keeps its own budget, so it can change apart from readiness.
const SETTLE_TIMEOUT_MILLISECONDS = readinessTimeoutMilliseconds;

/**
 * Runs in the page before its scripts and keeps the page heading and the
 * Article JSON-LD that the parser inserts from the static HTML. The app's one
 * module script is async, so it may run before the parser finishes; mutation
 * callbacks run at the end of each parser task, before that script's task, so
 * the kept nodes are the server's and not ones that hydration put back.
 */
function keepServerContent() {
  const kept: NonNullable<Window["nakafaServerContent"]> = {
    article: null,
    heading: null,
  };
  window.nakafaServerContent = kept;
  const observer = new MutationObserver(() => {
    kept.heading ??= document.querySelector("h1");
    kept.article ??=
      [...document.querySelectorAll('script[type="application/ld+json"]')].find(
        (script) => script.textContent?.includes('"@type":"Article"')
      ) ?? null;
    if (kept.heading !== null && kept.article !== null) {
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
}

/** Reads one sitemap document and lists the paths its `<loc>` entries name. */
const readLocations = Effect.fn("NakafaE2E.readLocations")(function* (
  page: Page,
  sitemap: string,
  location: RegExp
) {
  const response = yield* Effect.promise(() => page.request.get(sitemap));
  const xml = yield* Effect.promise(() => response.text());
  return Arr.flatMap(Arr.fromIterable(xml.matchAll(location)), ([, path]) =>
    path === undefined ? [] : [path]
  );
});

/** Lists the pages one family's sitemaps publish, through the sitemap index. */
const readFamilyPaths = Effect.fn("NakafaE2E.readFamilyPaths")(function* (
  page: Page,
  family: (typeof families)[number]
) {
  const sitemaps = Arr.filter(
    yield* readLocations(page, "/sitemap.xml", SITEMAP),
    (path) => family.sitemap.test(path)
  );
  return Arr.flatten(
    yield* Effect.forEach(sitemaps, (sitemap) =>
      readLocations(page, sitemap, family.location)
    )
  );
});

/**
 * Counts the Convex tokens the open page read. Only a client that settled on
 * a signed-in session asks for one.
 */
const watchConvexTokens = Effect.fn("NakafaE2E.watchConvexTokens")(function* (
  page: Page
) {
  const tokens = MutableRef.make(0);
  yield* Effect.sync(() =>
    page.on("response", (response) => {
      if (
        response.ok() &&
        new URL(response.url()).pathname === CONVEX_TOKEN_PATH
      ) {
        MutableRef.increment(tokens);
      }
    })
  );
  return tokens;
});

/**
 * Proves one static page keeps the heading and article the server sent: the
 * app's providers settle (session, Convex authentication, and consent) after
 * hydration, and the heading and Article JSON-LD that stay are the nodes the
 * HTML carried, so nothing client-rendered the content in their place.
 */
const verifyServerContentSurvives = Effect.fn(
  "NakafaE2E.verifyServerContentSurvives"
)(function* (
  page: Page,
  tokens: MutableRef.MutableRef<number>,
  signedIn: boolean,
  path: string
) {
  yield* Effect.sync(() => MutableRef.set(tokens, 0));
  const response = yield* Effect.promise(() =>
    page.goto(path, { waitUntil: "load" })
  );
  yield* Effect.sync(() => expect(response?.ok(), path).toBe(true));
  const kept = yield* Effect.promise(() =>
    page.evaluate(() => ({
      article: (window.nakafaServerContent?.article ?? null) !== null,
      heading: (window.nakafaServerContent?.heading ?? null) !== null,
    }))
  );
  yield* Effect.sync(() =>
    expect(kept, path).toStrictEqual({ article: true, heading: true })
  );
  // The usage data prompt opens once the session, Convex authentication, and
  // consent have resolved, the updates that would discard the content if they
  // reached it before it hydrated. A signed-in learner's prompt also waits for
  // the account and its consent.
  yield* Effect.promise(() =>
    expect(page.getByRole("region", { name: "Usage data" })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MILLISECONDS,
    })
  );
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
  yield* Effect.sync(() =>
    expect(MutableRef.get(tokens) > 0, path).toBe(signedIn)
  );
  const survived = yield* Effect.promise(() =>
    page.evaluate(() => {
      const server = window.nakafaServerContent;
      return {
        article: server?.article?.isConnected === true,
        heading: document.querySelector("h1") === server?.heading,
        headings: document.querySelectorAll("h1").length,
      };
    })
  );
  yield* Effect.sync(() =>
    expect(survived, path).toStrictEqual({
      article: true,
      heading: true,
      headings: 1,
    })
  );
});

/**
 * Lets a signed-in browser settle its session the way its first page does:
 * Better Auth answers once, and the browser keeps the id of that session, as
 * `saveKnownSession` writes it after each settled answer. The session test does
 * the same before it checks the saved session.
 */
const settleSignedInBrowser = Effect.fn("NakafaE2E.settleSignedInBrowser")(
  function* (page: Page) {
    yield* Effect.promise(() => page.goto("/en", { waitUntil: "load" }));
    yield* Effect.promise(() =>
      page.waitForFunction(
        (key) => window.localStorage.getItem(key) !== null,
        KNOWN_SESSION_KEY,
        { timeout: readinessTimeoutMilliseconds }
      )
    );
  }
);

/** Proves this run's slice of the lessons and articles survives hydration. */
const verifyRun = Effect.fn("NakafaE2E.verifyRun")(function* (
  page: Page,
  run: (typeof runs)[number]
) {
  yield* Effect.promise(() => page.addInitScript(keepServerContent));
  const tokens = yield* watchConvexTokens(page);
  for (const family of families) {
    const paths = yield* readFamilyPaths(page, family);
    yield* Effect.sync(() => expect(paths.length).toBeGreaterThan(0));
    const slice = Arr.getSomes(
      Arr.makeBy(family.count, (offset) =>
        Arr.get(paths, (run.slot * family.count + offset) % paths.length)
      )
    );
    yield* Effect.forEach(slice, (path) =>
      verifyServerContentSurvives(page, tokens, run.signedIn, path)
    );
  }
});

for (const run of runs) {
  test(`static lessons and articles keep their server content ${run.signedIn ? "signed in" : "signed out"} at ${run.viewport.width} px`, async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize(run.viewport);
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          if (run.signedIn) {
            const origin = yield* Effect.fromNullishOr(baseURL);
            yield* signInLearner(page.context(), origin);
            yield* settleSignedInBrowser(page);
          }
          yield* verifyRun(page, run);
        })
      )
    );
  });
}
