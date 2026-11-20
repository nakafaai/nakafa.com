import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The widths a learner meets, from the smallest phone to a wide desktop. */
const WIDTHS = [320, 390, 768, 1024, 1440, 1920] as const;

/** Pages of every kind that need no account: a lesson, an article, a surah and a try-out set. */
const PUBLIC = [
  "/en/subjects/chemistry/structure-matter/isotope",
  "/en/articles/politics/merah-putih-cabinet-analysis",
  appRoutes.quranSurahId,
  "/en/articles",
  "/en/curriculum",
  "/en/chat",
  appRoutes.tryout,
  "/en/try-out/indonesia/snbt/2027/utbk/set-1",
] as const;

/** The header rule fills the space beside the outline, while its row stays centered at up to 3xl. */
const readHeaderColumns = (page: Page, address: string) =>
  Effect.gen(function* () {
    yield* Effect.promise(() =>
      page.setViewportSize({ height: 900, width: WIDTHS[0] })
    );
    yield* Effect.promise(() => page.goto(address));
    yield* Effect.forEach(WIDTHS, (width) =>
      Effect.promise(async () => {
        await page.setViewportSize({ height: 900, width });
        const header = page
          .locator('[data-slot="page-header"]')
          .filter({ visible: true })
          .first();
        const label = `${address} at ${width}px`;
        await expect(async () => {
          const geometry = await header.evaluate((element) => {
            const band = element.getBoundingClientRect();
            const row = element
              .querySelector('[class*="@container/header"]')
              ?.getBoundingClientRect();
            const frame = element.closest(
              '[data-slot="page"],[data-slot="tryout-page"]'
            );
            let region = frame?.parentElement ?? element.parentElement;
            while (region && getComputedStyle(region).display === "contents") {
              region = region.parentElement;
            }
            if (!(region && row && element.isConnected) || band.width === 0) {
              return null;
            }
            const { paddingLeft, paddingRight } = getComputedStyle(region);
            const start =
              region.getBoundingClientRect().left +
              Number.parseFloat(paddingLeft);
            const available =
              region.clientWidth -
              Number.parseFloat(paddingLeft) -
              Number.parseFloat(paddingRight);
            return {
              available: Math.round(available),
              bandOffset: Math.round(band.left - start),
              rowOffset: Math.round(
                row.left + row.width / 2 - start - available / 2
              ),
              rowWidth: Math.round(row.width),
              width: Math.round(band.width),
            };
          });
          expect(geometry, label).not.toBeNull();
          expect(geometry?.width, label).toBe(geometry?.available);
          expect(geometry?.bandOffset, label).toBe(0);
          expect(geometry?.rowWidth, label).toBe(
            Math.min(768, geometry?.available ?? 0)
          );
          expect(geometry?.rowOffset, label).toBe(0);
        }).toPass({ timeout: readinessTimeoutMilliseconds });
      })
    );
  });

/** Measures each header in one context, after `signIn` prepares it. */
const readContext = <E>(
  browser: Parameters<typeof withBrowserContext>[0],
  baseURL: string,
  prepare: (context: BrowserContext, page: Page) => Effect.Effect<void, E>,
  addresses: readonly string[]
) =>
  withBrowserContext(browser, { baseURL, serviceWorkers: "block" }, (context) =>
    Effect.gen(function* () {
      const page = yield* Effect.promise(() => context.newPage());
      yield* prepare(context, page);
      return yield* Effect.forEach(addresses, (address) =>
        readHeaderColumns(page, address)
      );
    })
  );

/** The consumer shell sets one centered reading measure for public and signed-in pages. */
test("the consumer header spans the page around a centered 3xl row from 320 to 1920 px", async ({
  baseURL,
  browser,
}) => {
  test.slow();
  const base = String(baseURL);
  await Effect.runPromise(
    Effect.all(
      [
        readContext(browser, base, () => Effect.void, PUBLIC),
        readContext(
          browser,
          base,
          (context, page) =>
            signInLearner(context, base).pipe(
              Effect.andThen(Effect.promise(() => finishOnboarding(page)))
            ),
          ["/en/home", "/en/notifications", "/en/user/settings"]
        ),
      ],
      { concurrency: 1 }
    )
  );
});
