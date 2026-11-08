import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The name every synthetic learner carries, which a visit's title shows. */
const LEARNER_NAME = "Acceptance Learner";

/** The address of a visit, which Share hands to the share sheet. */
const VISIT = /\/en\/island\/[^/]+$/u;

/** The stored snapshot a visit names as its link's picture once the owner shared. */
const SNAPSHOT = /\/islands\//u;

/** The island's canvas once its first frame has drawn. */
const DRAWN = "canvas[data-drawn]";

test("a learner shares their island, and a signed-out visitor opens it read only with its snapshot as the link's picture", async ({
  baseURL,
  browser,
}, testInfo) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const owner = await browser.newContext({ baseURL: origin });
  // The share sheet belongs to the platform; the page hands it the link, which the test keeps.
  await owner.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        document.documentElement.dataset.shared = data.url ?? "";
        return Promise.resolve();
      },
    });
  });
  await Effect.runPromise(signInLearner(owner, origin));
  const page = await owner.newPage();
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.promise(async () => {
        await page.goto("/en/island");
        await expect(page.locator(DRAWN)).toBeVisible();
        await page.getByRole("button", { name: "More actions" }).click();
        await page.getByRole("menuitem", { name: "Share" }).click();
        await expect(page.locator("html")).toHaveAttribute(
          "data-shared",
          VISIT
        );
      })
    )
  );
  const address =
    (await page.locator("html").getAttribute("data-shared")) ?? "";
  const visitor = await browser.newContext({ baseURL: origin });
  const visit = await visitor.newPage();
  await Effect.runPromise(
    withObservedPageErrors(
      visit,
      Effect.promise(async () => {
        // The snapshot uploads after the link is handed on, so the visit names it a moment later.
        await expect
          .poll(
            async () => {
              await visit.goto(address);
              return visit
                .locator('meta[property="og:image"]')
                .getAttribute("content");
            },
            { timeout: readinessTimeoutMilliseconds }
          )
          .toMatch(SNAPSHOT);
        await expect(
          visit.getByText(`${LEARNER_NAME}'s Island`).first()
        ).toBeVisible();
        await expect(visit.locator(DRAWN)).toBeVisible();
        await visit.getByRole("button", { name: "More actions" }).click();
        await expect(
          visit.getByRole("menuitem", { name: "Turn right" })
        ).toBeVisible();
        await expect(
          visit.getByRole("menuitem", { name: "Share" })
        ).toHaveCount(0);
        await visit.keyboard.press("Escape");
      })
    )
  );
  await testInfo.attach("island-visit.png", {
    body: await visit.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await visitor.close();
  await owner.close();
});
