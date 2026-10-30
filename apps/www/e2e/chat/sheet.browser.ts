import { expect, type Route, test } from "@playwright/test";
import { Effect, MutableList, MutableRef } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openSheet } from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isTakenOver } from "@/e2e/support/window";

/** The page's built scripts, which a test holds back so React cannot take the page over. */
const SCRIPTS = /\/assets\/.*\.js/;

test.describe("Nina sheet at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("is named Nina alone, and its header buttons are not part of the name", async ({
    page,
  }) => {
    await Effect.runPromise(withObservedPageErrors(page, openSheet(page)));

    await expect(
      page.getByRole("dialog", { exact: true, name: "Nina" })
    ).toBeVisible();
  });

  test("opens on a press made before React takes the page over", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.promise(async () => {
          const held = MutableList.make<Route>();
          const released = MutableRef.make(false);
          await page.route(SCRIPTS, async (route) => {
            if (MutableRef.get(released)) {
              await route.continue();
              return;
            }
            MutableList.append(held, route);
          });
          await page.goto(LESSON_PATH);

          const ask = page.getByRole("button", {
            exact: true,
            name: "Ask Nina",
          });
          await ask.click();
          // React has not run, so the page keeps the press on the button.
          expect(MutableList.toArray(held).length).toBeGreaterThan(0);
          expect(await isTakenOver(ask)).toBe(false);
          await expect(ask).toHaveAttribute("data-pressed", "");

          MutableRef.set(released, true);
          for (const route of MutableList.toArray(held)) {
            await route.continue();
          }
          await expect(
            page.getByRole("dialog", { exact: true, name: "Nina" })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
          // The open sheet makes the entry inert, so the button is found by its mark.
          await expect(page.locator("[data-press]")).not.toHaveAttribute(
            "data-pressed"
          );
        })
      )
    );
  });
});
