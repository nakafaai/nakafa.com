import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { readAnatomy } from "@/e2e/support/anatomy";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The page's one rhythm under its header, `pageRhythmVariants`. */
const RHYTHM = 24;

/** The account's settings, one family: a press between them must not move the body. */
const SECTIONS = ["", "/learning", "/subscriptions", "/memory", "/connectors"];

test("every section of the account's settings starts its body one rhythm under the header, at 390 and 1440 px", async ({
  baseURL,
  browser,
}) => {
  test.setTimeout(readinessTimeoutMilliseconds * 12);
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));

  for (const section of SECTIONS) {
    await page.goto(`${baseURL}/en/user/settings${section}`);
    await expect(page.locator('[data-slot="page-header"]')).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ height: 844, width });
      await expect
        .poll(
          async () => {
            const anatomy = await readAnatomy(page);
            return { gap: anatomy.gap, problems: anatomy.problems };
          },
          { message: `/user/settings${section} at ${width}px` }
        )
        .toEqual({ gap: RHYTHM, problems: [] });
    }
  }
  await context.close();
});
