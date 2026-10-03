import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableRef, Schema } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { signInLearner } from "@/e2e/support/learner";

declare global {
  interface Window {
    nakafaContentReveal?: () => unknown;
    nakafaReleaseContent?: () => void;
  }
}

/** What the reveal hold saw on one page. */
const ContentReveal = Schema.Struct({
  discards: Schema.Int,
  held: Schema.Int,
});

const decodeContentReveal = Schema.decodeUnknownEffect(ContentReveal);

/** The English lessons the sitemaps publish. */
const lessons = {
  location: /<loc>https:\/\/nakafa\.com(\/en\/subjects\/[^<]+)<\/loc>/gu,
  sitemaps: ["/sitemap/material_en_p0.xml", "/sitemap/material_en_p1.xml"],
} as const;

/** The English articles the sitemap publishes, without category pages. */
const articles = {
  location:
    /<loc>https:\/\/nakafa\.com(\/en\/articles\/[^/<]+\/[^/<]+)<\/loc>/gu,
  sitemaps: ["/sitemap/article_en_p0.xml"],
} as const;

const LESSONS_PER_RUN = 3;

/**
 * Each run opens its own share of the lessons, so no run finds a lesson
 * another run already cached. English publishes one article beyond the one
 * prerendered at build time, so one run opens it.
 */
const runs = [
  {
    articles: 0,
    signedIn: false,
    slot: 0,
    viewport: { height: 844, width: 390 },
  },
  {
    articles: 1,
    signedIn: true,
    slot: 1,
    viewport: { height: 844, width: 390 },
  },
  {
    articles: 0,
    signedIn: false,
    slot: 2,
    viewport: { height: 900, width: 1440 },
  },
  {
    articles: 0,
    signedIn: true,
    slot: 3,
    viewport: { height: 900, width: 1440 },
  },
] as const;

const CONVEX_TOKEN_PATH = "/api/auth/convex/token";
const SETTLE_TIMEOUT_MILLISECONDS = 15_000;

/**
 * Runs in the page before its scripts. React's streaming runtime reveals
 * completed Suspense boundaries in batches through `$RV`; this hold keeps
 * every batch that carries the page heading queued until the test releases
 * it, so the content boundary stays pending while the app's providers settle
 * after hydration. A context change in that window makes React client-render
 * the pending boundary and remove its template, which the release counts as a
 * discard, as `$RC` does for a segment whose template is already gone.
 */
function holdContentReveal() {
  const held: Element[] = [];
  let completeOriginal = (_boundary: string, _segment: string) => undefined;
  let revealOriginal = (_queue: Element[]) => undefined;
  let discards = 0;
  let isReleased = false;

  const reveal = (queue: Element[]) => {
    for (let index = 0; index < queue.length; index += 2) {
      if (queue[index]?.parentNode === null) {
        discards += 1;
      }
    }
    revealOriginal(queue);
  };
  const revealUnlessContent = (queue: Element[]) => {
    const now: Element[] = [];
    for (let index = 0; index < queue.length; index += 2) {
      const template = queue[index];
      const segment = queue[index + 1];
      if (template === undefined || segment === undefined) {
        continue;
      }
      const target =
        !isReleased && segment.querySelector("h1") !== null ? held : now;
      target.push(template, segment);
    }
    // The runtime schedules the next batch only once its queue is empty again.
    queue.length = 0;
    reveal(now);
  };
  const complete = (boundary: string, segment: string) => {
    if (
      document.getElementById(segment) !== null &&
      document.getElementById(boundary) === null
    ) {
      discards += 1;
    }
    return completeOriginal(boundary, segment);
  };

  Object.defineProperty(window, "$RC", {
    configurable: true,
    get: () => complete,
    set: (original) => {
      completeOriginal = original;
    },
  });
  Object.defineProperty(window, "$RV", {
    configurable: true,
    get: () => revealUnlessContent,
    set: (original) => {
      revealOriginal = original;
    },
  });
  window.nakafaContentReveal = () => ({ discards, held: held.length / 2 });
  window.nakafaReleaseContent = () => {
    isReleased = true;
    reveal(held.splice(0));
  };
}

const readContentReveal = Effect.fn("NakafaE2E.readContentReveal")(function* (
  page: Page
) {
  const reveal = yield* Effect.promise(() =>
    page.evaluate(() => window.nakafaContentReveal?.())
  );
  return yield* decodeContentReveal(reveal).pipe(Effect.orDie);
});

/** Lists the pages one family's sitemaps publish. */
const readSitemapPaths = Effect.fn("NakafaE2E.readSitemapPaths")(function* (
  page: Page,
  family: typeof lessons | typeof articles
) {
  const documents = yield* Effect.forEach(family.sitemaps, (path) =>
    Effect.promise(() => page.request.get(path)).pipe(
      Effect.flatMap((response) => Effect.promise(() => response.text()))
    )
  );
  return Arr.flatMap(documents, (xml) =>
    Arr.flatMap(Arr.fromIterable(xml.matchAll(family.location)), ([, path]) =>
      path === undefined ? [] : [path]
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
 * Opens one page with its reveal held and reports whether the server
 * streamed it cold: rendered on demand from its postponed shell, so the
 * content boundary was still pending when the page hydrated.
 */
const openHeldPage = Effect.fn("NakafaE2E.openHeldPage")(function* (
  page: Page,
  path: string
) {
  const response = yield* Effect.promise(() =>
    page.goto(path, { waitUntil: "load" })
  );
  return response?.headers()["x-nextjs-postponed"] === "1";
});

/**
 * Proves one cold page keeps the heading and article the server streamed:
 * the app settles while the content is still pending, nothing client-renders
 * the content in that window, and the released segment is the DOM that stays.
 */
const verifyStreamedContentSurvives = Effect.fn(
  "NakafaE2E.verifyStreamedContentSurvives"
)(function* (
  page: Page,
  tokens: MutableRef.MutableRef<number>,
  signedIn: boolean
) {
  const services = yield* Effect.context<never>();
  // The content segment either waits in the hold or, when React already
  // client-rendered its boundary, is discarded as it arrives.
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        Effect.runPromiseWith(services)(
          readContentReveal(page).pipe(
            Effect.map(({ discards, held }) => discards + held)
          )
        )
      )
      .toBeGreaterThan(0)
  );
  const arrived = yield* readContentReveal(page);
  yield* Effect.sync(() =>
    expect(arrived).toStrictEqual({ discards: 0, held: 1 })
  );
  const streamed = yield* Effect.promise(() =>
    page.evaluateHandle(() => ({
      article: [
        ...document.querySelectorAll(
          'div[hidden] script[type="application/ld+json"]'
        ),
      ].find((script) => script.textContent?.includes('"@type":"Article"')),
      heading: document.querySelector("div[hidden] h1"),
    }))
  );
  // The usage data prompt opens once the session, Convex authentication, and
  // consent have resolved, the updates that used to discard the content. A
  // signed-in learner's prompt also waits for the account and its consent.
  yield* Effect.promise(() =>
    expect(page.getByRole("region", { name: "Usage data" })).toBeVisible({
      timeout: SETTLE_TIMEOUT_MILLISECONDS,
    })
  );
  const beforeRelease = yield* Effect.promise(() =>
    page.evaluate(
      () => document.querySelectorAll("h1:not(div[hidden] h1)").length
    )
  );
  yield* Effect.sync(() => {
    expect(beforeRelease).toBe(0);
    expect(MutableRef.get(tokens) > 0).toBe(signedIn);
  });

  yield* Effect.promise(() =>
    page.evaluate(() => window.nakafaReleaseContent?.())
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  );
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
  const survived = yield* Effect.promise(() =>
    page.evaluate(
      ({ article, heading }) => ({
        article:
          article?.isConnected === true &&
          article.closest("div[hidden]") === null,
        heading: document.querySelector("h1") === heading,
        headings: document.querySelectorAll("h1").length,
      }),
      streamed
    )
  );
  const reveal = yield* readContentReveal(page);
  yield* Effect.sync(() => {
    expect(reveal).toStrictEqual({ discards: 0, held: 0 });
    expect(survived).toStrictEqual({
      article: true,
      heading: true,
      headings: 1,
    });
  });
});

/** Opens pages in order until the wanted number of cold ones survived. */
const verifyColdPages = Effect.fn("NakafaE2E.verifyColdPages")(function* (
  page: Page,
  tokens: MutableRef.MutableRef<number>,
  signedIn: boolean,
  paths: readonly string[],
  wanted: number
) {
  let verified = 0;
  for (const path of paths) {
    if (verified === wanted) {
      break;
    }
    MutableRef.set(tokens, 0);
    // A page prerendered at build time, or opened before on this runtime,
    // arrives whole and streams nothing.
    if (yield* openHeldPage(page, path)) {
      yield* verifyStreamedContentSurvives(page, tokens, signedIn);
      verified += 1;
    }
  }
  yield* Effect.sync(() => expect(verified).toBe(wanted));
});

/** Proves this run's cold lessons, and its article, survive hydration. */
const verifyRun = Effect.fn("NakafaE2E.verifyRun")(function* (
  page: Page,
  run: (typeof runs)[number]
) {
  yield* Effect.promise(() => page.addInitScript(holdContentReveal));
  const tokens = yield* watchConvexTokens(page);
  const lessonPaths = yield* readSitemapPaths(page, lessons);
  yield* verifyColdPages(
    page,
    tokens,
    run.signedIn,
    Arr.filter(lessonPaths, (_, index) => index % runs.length === run.slot),
    LESSONS_PER_RUN
  );
  if (run.articles > 0) {
    const articlePaths = yield* readSitemapPaths(page, articles);
    yield* verifyColdPages(
      page,
      tokens,
      run.signedIn,
      articlePaths,
      run.articles
    );
  }
});

for (const run of runs) {
  test(`cold ${run.articles > 0 ? "lessons and an article" : "lessons"} keep their streamed content ${run.signedIn ? "signed in" : "signed out"} at ${run.viewport.width} px`, async ({
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
          }
          yield* verifyRun(page, run);
        })
      )
    );
  });
}
