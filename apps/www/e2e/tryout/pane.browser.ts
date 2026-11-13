import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

const TRACK_PATH = "/en/try-out/indonesia/snbt/2027/utbk";

/**
 * The owner's sketch IMG_1029: a press on the row of a set nobody has started opens the set beside the table, with
 * its name, its parts and Start, and marks the row while it stays open. The name's link opens it too, Escape closes
 * it, and a visitor's Start goes to sign in and comes back to the set.
 */
test.describe("The set pane beside a track's table", () => {
  test.use({ viewport: viewportSize(desktopViewport) });

  test("opens an unstarted set from its row and its name, marks the row, and closes on Escape", async ({
    page,
  }) => {
    await page.goto(TRACK_PATH, { waitUntil: "load" });
    const table = page.getByRole("table");
    const first = table.getByRole("row").nth(1);
    await expect(first).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await waitUntilTakenOver(first.getByRole("link").first());

    // A press beside the name opens the row's set.
    await first.getByRole("cell").nth(2).click();
    const pane = page.getByRole("complementary", {
      name: en.Tryouts["set-pane"],
    });
    await expect(pane).toBeVisible();
    await expect(pane.getByRole("heading", { name: "Set 1" })).toBeVisible();
    await expect(first).toHaveAttribute("data-state", "selected");
    await expect(
      pane.getByRole("heading", { name: en.Tryouts["set-pane-parts"] })
    ).toBeVisible();
    await expect(
      pane.getByRole("button", { exact: true, name: en.Tryouts["start-cta"] })
    ).toBeVisible();

    // The second set's name opens it in place of the first, and the page stays on the track.
    const second = table.getByRole("row").nth(2);
    await second.getByRole("link").first().click();
    await expect(pane.getByRole("heading", { name: "Set 2" })).toBeVisible();
    await expect(second).toHaveAttribute("data-state", "selected");
    await expect(first).not.toHaveAttribute("data-state", "selected");
    expect(new URL(page.url()).pathname).toBe(TRACK_PATH);

    await page.keyboard.press("Escape");
    await expect(pane).toBeHidden();
  });

  test("sends a visitor's Start to sign in, coming back to the set", async ({
    page,
  }) => {
    await page.goto(TRACK_PATH, { waitUntil: "load" });
    const first = page.getByRole("table").getByRole("row").nth(1);
    await expect(first).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await waitUntilTakenOver(first.getByRole("link").first());
    await first.getByRole("cell").nth(2).click();
    const pane = page.getByRole("complementary", {
      name: en.Tryouts["set-pane"],
    });
    await pane
      .getByRole("button", { exact: true, name: en.Tryouts["start-cta"] })
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/en/auth");
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(
      `${TRACK_PATH}/set-1`
    );
  });
});
