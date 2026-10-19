import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes, openRoute } from "@/e2e/support/route";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";
import { isHydrated } from "@/e2e/support/window";

/**
 * The owner's rule (18 Oct): every page header is one row at every width. A header
 * is 64 px tall when its content fits one row, so a header that wraps a title, a
 * path or an action under another grows past it. Nothing inside it may reach past
 * its edges either: a long title truncates instead. A page without a header row of
 * its own has the app's bar as its header below the desktop breakpoint, so the bar
 * is held to the same rule.
 */
const ONE_ROW_PX = 64.5;

/** The widths the window narrows through: a desktop, a tablet, and two phones. */
const widths = [desktopViewport.width, 768, 390, 320];

/** Below this width the app's sidebar folds away, so every page shows a header row. */
const DESKTOP_PX = 1024;

/** The pages that need no account: each kind of public header, with long titles. */
const publicRoutes = [
  appRoutes.quranSurahId,
  appRoutes.quran,
  appRoutes.tryout,
  "/en/try-out/indonesia",
  "/en/try-out/indonesia/snbt",
  "/en/try-out/indonesia/snbt/2027",
  "/en/try-out/indonesia/snbt/2027/set-1",
  "/en/curriculum",
  "/en/curriculum/merdeka",
  "/en/curriculum/merdeka/class-10",
  LESSON_PATH,
  "/en/articles/politics",
  "/en/articles/politics/merah-putih-cabinet-analysis",
];

/** The try-out page of an exam, which a phone reaches from a set page's folded path. */
const EXAM_PAGE = /\/en\/try-out\/indonesia\/snbt$/;

/** The pages of a signed-in learner, each with its own header. */
const learnerRoutes = ["/en/chat", "/en/user/settings", "/en/notifications"];

/** The pages of a school host that an Owner sees. */
const schoolPaths = ["/", "/exams", "/settings/profile", "/settings/roles"];

/**
 * Reads every header row that is drawn, the page's own or the app's bar: its
 * height, and the elements inside it whose box reaches past its right or bottom
 * edge. Elements hidden at this width and the screen reader's one-pixel boxes are
 * left out.
 */
function readHeaders() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-slot="page-header"], [data-slot="app-header"]'
    )
  )
    .filter((header) => header.getBoundingClientRect().height > 0)
    .map((header) => {
      const edge = header.getBoundingClientRect();
      const outside = Array.from(header.querySelectorAll<HTMLElement>("*"))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.width > 1 &&
            box.height > 1 &&
            (box.right > edge.right + 1 || box.bottom > edge.bottom + 1)
          );
        })
        .map(
          (element) =>
            `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`
        );
      return { height: edge.height, outside };
    });
}

/** Lets two animation frames pass, so a change of width has been laid out. */
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

/** Narrows the window through every width and checks that each header stays one row. */
const expectOneRowHeaders = Effect.fn("NakafaE2E.expectOneRowHeaders")(
  function* (page: Page, label: string) {
    yield* Effect.promise(() =>
      expect(page.locator("h1").first()).toBeAttached({ timeout: 30_000 })
    );
    yield* Effect.forEach(
      widths,
      (width) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            page.setViewportSize({ height: desktopViewport.height, width })
          );
          yield* Effect.promise(() => twoFrames(page));
          const headers = yield* Effect.promise(() =>
            page.evaluate(readHeaders)
          );
          yield* Effect.sync(() => {
            if (width < DESKTOP_PX) {
              expect(headers.length, `${label} at ${width}px`).toBeGreaterThan(
                0
              );
            }
            Arr.forEach(headers, (header) => {
              expect(
                header.height,
                `${label} at ${width}px: the header takes more than one row`
              ).toBeLessThanOrEqual(ONE_ROW_PX);
              expect(
                header.outside,
                `${label} at ${width}px: these reach past the header`
              ).toEqual([]);
            });
          });
        }),
      { discard: true }
    );
  }
);

/** Opens a page in a fresh desktop context and checks its header at every width. */
const checkPage = <E>(
  browser: Parameters<typeof withBrowserContext>[0],
  baseURL: string,
  prepare: (context: BrowserContext) => Effect.Effect<string, E>,
  label: string
) =>
  withBrowserContext(
    browser,
    {
      baseURL,
      serviceWorkers: "block",
      viewport: viewportSize(desktopViewport),
    },
    (context) =>
      Effect.gen(function* () {
        const href = yield* prepare(context);
        const page = yield* Effect.promise(() => context.newPage());
        yield* withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* openRoute(page, href, "denied");
            yield* expectOneRowHeaders(page, label);
          })
        );
      })
  );

for (const route of publicRoutes) {
  test(`${route} keeps its header to one row from 1440 px down to 320 px`, async ({
    baseURL,
    browser,
  }) => {
    await Effect.runPromise(
      checkPage(browser, String(baseURL), () => Effect.succeed(route), route)
    );
  });
}

test("a signed-in learner's pages keep their headers to one row at every width", async ({
  baseURL,
  browser,
}) => {
  await Effect.runPromise(
    Effect.forEach(
      learnerRoutes,
      (route) =>
        checkPage(
          browser,
          String(baseURL),
          (context) =>
            signInLearner(context, String(baseURL)).pipe(Effect.as(route)),
          route
        ),
      { discard: true }
    )
  );
});

test("a school's pages keep their headers to one row at every width", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const home = hostAddress(baseURL, host, "/");
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: String(baseURL),
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          yield* signInOwner(context, school.slug, home);
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.forEach(
            schoolPaths,
            (path) =>
              Effect.gen(function* () {
                yield* Effect.promise(() =>
                  page.setViewportSize(viewportSize(desktopViewport))
                );
                yield* Effect.promise(() =>
                  page.goto(hostAddress(baseURL, host, path))
                );
                yield* expectOneRowHeaders(page, `school ${path}`);
              }),
            { discard: true }
          );
        })
    )
  );
});

test("a phone opens a folded ancestor of the path with a tap", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      openRoute(page, "/en/try-out/indonesia/snbt/2027/set-1", "denied")
    )
  );
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  const more = breadcrumb.getByRole("button");
  // The page answers before its scripts run, and a tap before React has taken the
  // button over opens nothing, so the tap waits for it.
  await expect
    .poll(() => isHydrated(more), { timeout: readinessTimeoutMilliseconds })
    .toBe(true);
  await more.click();
  await page
    .getByRole("menu")
    .locator('a[href="/en/try-out/indonesia/snbt"]')
    .click();
  await expect(page).toHaveURL(EXAM_PAGE);
});
