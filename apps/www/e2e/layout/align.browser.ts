import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { appRoutes } from "@/e2e/support/route";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

/** The widths a learner meets: a phone, a laptop, and two desktops. */
const WIDTHS = [390, 1024, 1440, 1920] as const;

/** Pages of every kind that need no account: a lesson, an article, a surah and a try-out set. */
const PUBLIC = [
  "/en/subjects/chemistry/structure-matter/isotope",
  "/en/articles/politics/merah-putih-cabinet-analysis",
  appRoutes.quranSurahId,
  "/en/try-out/indonesia/snbt/2027/utbk/set-1",
] as const;

/** Where the header's path starts, at each width, in whole pixels. */
const readPathStarts = (page: Page, address: string) =>
  Effect.map(
    Effect.forEach(WIDTHS, (width) =>
      Effect.promise(async () => {
        await page.setViewportSize({ height: 900, width });
        await page.goto(address);
        const path = page
          .locator('[data-slot="page-header"] [data-slot="breadcrumb"]')
          .filter({ visible: true })
          .first();
        await expect(path).toBeVisible();
        const box = await path.boundingBox();
        return Math.round(box?.x ?? Number.NaN);
      })
    ),
    (starts) => ({ address, starts })
  );

/** Reads the path's start on each page in one context, after `signIn` prepares it. */
const readContext = <E>(
  browser: Parameters<typeof withBrowserContext>[0],
  baseURL: string,
  signIn: (context: BrowserContext) => Effect.Effect<void, E>,
  addresses: readonly string[]
) =>
  withBrowserContext(browser, { baseURL, serviceWorkers: "block" }, (context) =>
    Effect.gen(function* () {
      yield* signIn(context);
      const page = yield* Effect.promise(() => context.newPage());
      return yield* Effect.forEach(addresses, (address) =>
        readPathStarts(page, address)
      );
    })
  );

/**
 * The owner's rule (17 Nov): every page's header is one width, so its path starts at the same place on a lesson, an
 * article, a surah, a setting, a try-out set and a School's table at every width, and a press between them moves
 * nothing in the header.
 */
test("the header's path starts at one place on every kind of page at 390, 1024, 1440 and 1920 px", async ({
  baseURL,
  browser,
}) => {
  test.slow();
  const base = String(baseURL);
  const school = await Effect.runPromise(createSchool());
  const schoolAddress = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const pages = await Effect.runPromise(
    Effect.all(
      [
        readContext(browser, base, () => Effect.void, PUBLIC),
        readContext(browser, base, (context) => signInLearner(context, base), [
          "/en/user/settings",
        ]),
        readContext(
          browser,
          base,
          (context) => signInOwner(context, school.slug, schoolAddress("/")),
          [schoolAddress("/exams")]
        ),
      ],
      { concurrency: 1 }
    ).pipe(Effect.map(Arr.flatten))
  );
  Arr.forEach(WIDTHS, (width, column) => {
    const lesson = pages[0]?.starts[column];
    Arr.forEach(pages, ({ address, starts }) =>
      expect(starts[column], `${address} at ${width}px`).toBe(lesson)
    );
  });
});
