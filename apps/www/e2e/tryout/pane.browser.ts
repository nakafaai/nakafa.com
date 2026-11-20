import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

const TRACK_PATH = "/en/try-out/indonesia/snbt/2027/utbk";

/** The address of the track's one set, which opens its pane. */
const SET_PATH = `${TRACK_PATH}/set-1`;

/** The four levels a set can measure at, as the table and the pane name them. */
const LEVELS = [
  en.Tryouts["level-easy"],
  en.Tryouts["level-medium"],
  en.Tryouts["level-hard"],
  en.Tryouts["level-cooked"],
];

/** Opens the track as a visitor, once the page has loaded. */
async function openTrack(page: Page) {
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
 * The owner's notes of 20 Nov: a press on a set's row opens the set beside the table at the set's own address, with
 * its name, its parts as a path, what it gives, and its level beside Start, and marks the row while it stays open.
 * The name's link opens it too, Escape closes it back to the track, the set's address opens the same pane, and a
 * visitor's Start goes to sign in and comes back to the set.
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
    // The pane stands at the set's own address, so a learner can send it.
    expect(new URL(page.url()).pathname).toBe(SET_PATH);
    // The set's measured level stands at the start of the pane's footer, never in its title.
    const cell = await first.getByRole("cell").nth(1).textContent();
    const level = cell?.trim() ?? "";
    expect(LEVELS).toContain(level);
    await expect(
      pane.locator("footer").getByText(level, { exact: true })
    ).toBeVisible();
    // The set's parts stand as one path, each step a link to its part, and what the set gives under them.
    await expect(
      pane.getByRole("heading", {
        exact: true,
        name: en.Tryouts["parts-title"],
      })
    ).toBeVisible();
    await expect(pane.getByRole("link").first()).toBeVisible();
    await expect(
      pane.getByRole("heading", {
        exact: true,
        name: en.Tryouts["rewards-title"],
      })
    ).toBeVisible();
    await expect(
      pane.getByRole("button", {
        exact: true,
        name: en.Tryouts.action["start-cta"],
      })
    ).toBeVisible();

    // Escape closes it, back at the track's address, and the row lets go of its mark; the set's name opens it
    // again. Every track of the acceptance release holds one set, so the name opens the same one.
    await page.keyboard.press("Escape");
    await expect(pane).toBeHidden();
    await expect.poll(() => new URL(page.url()).pathname).toBe(TRACK_PATH);
    await expect(first).not.toHaveAttribute("data-state", "selected");
    await first.getByRole("link").first().click();
    await expect(
      pane.getByRole("heading", { exact: true, name: await rowName(first) })
    ).toBeVisible();
    await expect(first).toHaveAttribute("data-state", "selected");
    expect(new URL(page.url()).pathname).toBe(SET_PATH);
  });

  test("opens a set's own address in its pane beside the table", async ({
    page,
  }) => {
    await page.goto(SET_PATH, { waitUntil: "load" });
    const pane = page.getByRole("complementary", {
      name: en.Tryouts["set-pane"],
    });
    await expect(pane).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    const first = page.getByRole("table").getByRole("row").nth(1);
    await expect(first).toHaveAttribute("data-state", "selected");
    await expect(
      pane.getByRole("heading", { exact: true, name: await rowName(first) })
    ).toBeVisible();
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
      .getByRole("button", {
        exact: true,
        name: en.Tryouts.action["start-cta"],
      })
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/en/auth");
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(SET_PATH);
  });
});
