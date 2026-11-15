import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

const TRACK_PATH = "/en/try-out/indonesia/snbt/2027/utbk";

/**
 * Opens the track as a visitor who already answered the usage-data prompt, whose card would otherwise stand over
 * the pane's footer in the corner of the screen.
 */
async function openTrack(page: Page) {
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await page.goto(TRACK_PATH, { waitUntil: "load" });
}

/** A cell that holds a count alone. */
const COUNT = /^\d+$/u;

/**
 * The cell of a row's question count: a press beside the name that lands on no badge, whose tooltip would take the
 * first Escape for itself.
 */
function questionsCell(row: Locator) {
  return row.getByRole("cell").filter({ hasText: COUNT }).first();
}

/** The name a set's row shows in full, which its pane's heading repeats. */
async function rowName(row: Locator) {
  return (
    (await row
      .getByRole("link")
      .first()
      .locator("[title]")
      .getAttribute("title")) ?? ""
  );
}

/**
 * The owner's sketch of the pane: a press on the row of a set nobody has started opens the set beside the table, with
 * its name, its parts and Start, and marks the row while it stays open. The name's link opens it too, Escape closes
 * it, and a visitor's Start goes to sign in and comes back to the set.
 */
test.describe("The set pane beside a track's table", () => {
  test.use({ viewport: viewportSize(desktopViewport) });

  test("opens an unstarted set from its row and its name, marks the row, and closes on Escape", async ({
    page,
  }) => {
    await openTrack(page);
    const table = page.getByRole("table");
    const first = table.getByRole("row").nth(1);
    await expect(first).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await waitUntilTakenOver(first.getByRole("link").first());

    // A press beside the name opens the row's set.
    await questionsCell(first).click();
    const pane = page.getByRole("complementary", {
      name: en.Tryouts["set-pane"],
    });
    await expect(pane).toBeVisible();
    await expect(
      pane.getByRole("heading", { exact: true, name: await rowName(first) })
    ).toBeVisible();
    await expect(first).toHaveAttribute("data-state", "selected");
    // The set's parts stand in the set page's own list, each row a link to its part, with no heading above them.
    await expect(pane.getByRole("link").first()).toBeVisible();
    await expect(
      pane.getByRole("button", { exact: true, name: en.Tryouts["start-cta"] })
    ).toBeVisible();

    // Escape closes it and the row lets go of its mark; the set's name opens it again, and the page stays on the
    // track. Every track of the acceptance release holds one set, so the name opens the same one.
    await page.keyboard.press("Escape");
    await expect(pane).toBeHidden();
    await expect(first).not.toHaveAttribute("data-state", "selected");
    await first.getByRole("link").first().click();
    await expect(
      pane.getByRole("heading", { exact: true, name: await rowName(first) })
    ).toBeVisible();
    await expect(first).toHaveAttribute("data-state", "selected");
    expect(new URL(page.url()).pathname).toBe(TRACK_PATH);
  });

  test("sends a visitor's Start to sign in, coming back to the set", async ({
    page,
  }) => {
    await openTrack(page);
    const first = page.getByRole("table").getByRole("row").nth(1);
    await expect(first).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await waitUntilTakenOver(first.getByRole("link").first());
    await questionsCell(first).click();
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
