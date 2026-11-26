import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The widths a learner meets, from the smallest phone to a wide desktop. */
const WIDTHS = [320, 390, 768, 1024, 1440, 1920] as const;

/** The consumer reading measure (3xl) and catalog card grid measure (4xl). */
const COLUMN_WIDTH = 768;
const CATALOG_WIDTH = 896;

const HeaderTargetSchema = Schema.Struct({
  address: Schema.String,
  max: Schema.Finite,
});
type HeaderTarget = typeof HeaderTargetSchema.Type;

/** Pages of every kind that need no account, with the width their frame sets. */
const PUBLIC: readonly HeaderTarget[] = [
  {
    address: "/en/subjects/chemistry/structure-matter/isotope",
    max: COLUMN_WIDTH,
  },
  {
    address: "/en/articles/politics/merah-putih-cabinet-analysis",
    max: COLUMN_WIDTH,
  },
  { address: appRoutes.quranSurahId, max: COLUMN_WIDTH },
  { address: "/en/articles", max: COLUMN_WIDTH },
  { address: "/en/curriculum", max: CATALOG_WIDTH },
  { address: "/en/curriculum/merdeka", max: CATALOG_WIDTH },
  { address: "/en/chat", max: COLUMN_WIDTH },
  { address: appRoutes.tryout, max: CATALOG_WIDTH },
  {
    address: "/en/try-out/indonesia/tka/senior-high-school",
    max: CATALOG_WIDTH,
  },
  { address: "/en/try-out/indonesia/snbt/2027/utbk/set-1", max: CATALOG_WIDTH },
];

/** The header rule fills the space beside the outline, while its row stays centered up to the page's width. */
const readHeaderColumns = (page: Page, target: HeaderTarget) =>
  Effect.gen(function* () {
    const { address, max } = target;
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
            Math.min(max, geometry?.available ?? 0)
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
  targets: readonly HeaderTarget[]
) =>
  withBrowserContext(browser, { baseURL, serviceWorkers: "block" }, (context) =>
    Effect.gen(function* () {
      const page = yield* Effect.promise(() => context.newPage());
      yield* prepare(context, page);
      return yield* Effect.forEach(targets, (target) =>
        readHeaderColumns(page, target)
      );
    })
  );

/** The consumer shell sets a 3xl reading measure by default and 4xl for catalog card pages. */
test("the consumer header spans the page around its centered 3xl or 4xl row from 320 to 1920 px", async ({
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
          [
            { address: "/en/home", max: COLUMN_WIDTH },
            { address: "/en/notifications", max: COLUMN_WIDTH },
            { address: "/en/user/settings", max: COLUMN_WIDTH },
          ]
        ),
      ],
      { concurrency: 1 }
    )
  );
});
