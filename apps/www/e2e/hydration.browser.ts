import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Schema } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";

declare global {
  interface Window {
    nakafaLessonReveal?: () => unknown;
    nakafaReleaseLesson?: () => void;
  }
}

/** What the reveal hold saw on one page. */
const LessonReveal = Schema.Struct({
  discards: Schema.Int,
  held: Schema.Int,
});

const decodeLessonReveal = Schema.decodeUnknownEffect(LessonReveal);

const COLD_LESSONS_PER_VIEWPORT = 3;
const LESSON_LOCATION =
  /<loc>https:\/\/nakafa\.com(\/en\/subjects\/[^<]+)<\/loc>/gu;

/**
 * Runs in the page before its scripts. React's streaming runtime reveals
 * completed Suspense boundaries in batches through `$RV`; this hold keeps
 * every batch that carries the lesson heading queued until the test releases
 * it, so the lesson boundary stays pending while the app's providers settle
 * after hydration. A context change in that window makes React client-render
 * the pending boundary and remove its template, which the release counts as a
 * discard, as `$RC` does for a segment whose template is already gone.
 */
function holdLessonReveal() {
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
  const revealUnlessLesson = (queue: Element[]) => {
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
    get: () => revealUnlessLesson,
    set: (original) => {
      revealOriginal = original;
    },
  });
  window.nakafaLessonReveal = () => ({ discards, held: held.length / 2 });
  window.nakafaReleaseLesson = () => {
    isReleased = true;
    reveal(held.splice(0));
  };
}

const readLessonReveal = Effect.fn("NakafaE2E.readLessonReveal")(function* (
  page: Page
) {
  const reveal = yield* Effect.promise(() =>
    page.evaluate(() => window.nakafaLessonReveal?.())
  );
  return yield* decodeLessonReveal(reveal).pipe(Effect.orDie);
});

/** Lists the English lessons the sitemap publishes, newest topics last. */
const readEnglishLessons = Effect.fn("NakafaE2E.readEnglishLessons")(function* (
  page: Page
) {
  const pages = yield* Effect.forEach(
    ["/sitemap/material_en_p0.xml", "/sitemap/material_en_p1.xml"],
    (path) =>
      Effect.promise(() => page.request.get(path)).pipe(
        Effect.flatMap((response) => Effect.promise(() => response.text()))
      )
  );
  return Arr.flatMap(pages, (xml) =>
    Arr.flatMap(Arr.fromIterable(xml.matchAll(LESSON_LOCATION)), ([, path]) =>
      path === undefined ? [] : [path]
    )
  );
});

/**
 * Opens one lesson with its reveal held and reports whether the server
 * streamed it cold: rendered on demand from its postponed shell, so the
 * lesson boundary was still pending when the page hydrated.
 */
const openHeldLesson = Effect.fn("NakafaE2E.openHeldLesson")(function* (
  page: Page,
  path: string
) {
  const response = yield* Effect.promise(() =>
    page.goto(path, { waitUntil: "load" })
  );
  return response?.headers()["x-nextjs-postponed"] === "1";
});

/**
 * Proves one cold lesson keeps the heading and article the server streamed:
 * the app settles while the lesson is still pending, nothing client-renders
 * the lesson in that window, and the released segment is the DOM that stays.
 */
const verifyStreamedLessonSurvives = Effect.fn(
  "NakafaE2E.verifyStreamedLessonSurvives"
)(function* (page: Page) {
  const services = yield* Effect.context<never>();
  // The lesson segment either waits in the hold or, when React already
  // client-rendered its boundary, is discarded as it arrives.
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        Effect.runPromiseWith(services)(
          readLessonReveal(page).pipe(
            Effect.map(({ discards, held }) => discards + held)
          )
        )
      )
      .toBeGreaterThan(0)
  );
  const arrived = yield* readLessonReveal(page);
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
  // consent have resolved, the updates that used to discard the lesson.
  yield* Effect.promise(() =>
    expect(page.getByRole("region", { name: "Usage data" })).toBeVisible()
  );
  const beforeRelease = yield* Effect.promise(() =>
    page.evaluate(
      () => document.querySelectorAll("h1:not(div[hidden] h1)").length
    )
  );
  yield* Effect.sync(() => expect(beforeRelease).toBe(0));

  yield* Effect.promise(() =>
    page.evaluate(() => window.nakafaReleaseLesson?.())
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
  const reveal = yield* readLessonReveal(page);
  yield* Effect.sync(() => {
    expect(reveal).toStrictEqual({ discards: 0, held: 0 });
    expect(survived).toStrictEqual({
      article: true,
      heading: true,
      headings: 1,
    });
  });
});

/** Walks the sitemap until enough cold lessons proved they survive hydration. */
const verifyColdLessons = Effect.fn("NakafaE2E.verifyColdLessons")(function* (
  page: Page
) {
  yield* Effect.promise(() => page.addInitScript(holdLessonReveal));
  const lessons = yield* readEnglishLessons(page);
  let verified = 0;
  for (const lesson of Arr.reverse(lessons)) {
    if (verified === COLD_LESSONS_PER_VIEWPORT) {
      break;
    }
    // A lesson another suite already opened is cached whole and streams nothing.
    if (yield* openHeldLesson(page, lesson)) {
      yield* verifyStreamedLessonSurvives(page);
      verified += 1;
    }
  }
  yield* Effect.sync(() => expect(verified).toBe(COLD_LESSONS_PER_VIEWPORT));
});

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`cold lessons keep their streamed heading and article at ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await Effect.runPromise(
      withObservedPageErrors(page, verifyColdLessons(page))
    );
  });
}
