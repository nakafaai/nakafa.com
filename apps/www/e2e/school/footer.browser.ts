import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The question removal, which a test refuses to see the grid roll back. */
const REMOVE = "exams/questions:remove";

/** The prompts of the three questions, in their first order. */
const PROMPTS = ["Soal satu", "Soal dua", "Soal tiga"] as const;

/** The counter's name at any page of the three, and at each page. */
const ANY_OF_THREE = /^Question \d of 3/u;
const FIRST_OF_THREE = /^Question 1 of 3/u;
const SECOND_OF_THREE = /^Question 2 of 3/u;
const THIRD_OF_THREE = /^Question 3 of 3/u;

/** The strip's thumbnail of the third question, whose name starts with its number. */
const THIRD_THUMBNAIL = /^Question 3/u;

/** A grid tile, whose name opens its question. */
const OPEN_TILE = /^Open question/u;

/** The first page of the canvas, whose name starts with its number. */
const FIRST_PAGE = /^Question 1\b/u;

/** The zoom the column of pages is drawn at, read from its style. */
const columnZoom = (page: Page) =>
  page
    .getByRole("region", { name: "Exam pages" })
    .locator("> div")
    .evaluate((column) => Number(getComputedStyle(column).zoom));

/** Creates an exam of three questions with their prompts, and waits until the server holds them. */
async function examOfThree(page: Page, baseURL: string | undefined) {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  await Effect.runPromise(
    signInOwner(page.context(), school.slug, hostAddress(baseURL, host, "/"))
  );
  const changes = await Effect.runPromise(trackChanges(page, []));
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await waitUntilTakenOver(page.getByRole("button", { name: "Create exam" }));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Footer");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const sentBefore = changes.sent;
  for (let index = 0; index < PROMPTS.length; index += 1) {
    if (index > 0) {
      await page
        .getByRole("button", { name: "Add question", exact: true })
        .click();
    }
    const text = page.getByRole("textbox", {
      name: `Question ${index + 1} text`,
    });
    await expect(text).toBeEditable({ timeout: readinessTimeoutMilliseconds });
    await text.click();
    await page.keyboard.type(PROMPTS[index] ?? "");
  }
  await saved(changes, sentBefore);
  return changes;
}

test.describe("at 1440", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("the zoom slider shows its track and moves the pages, and every preset, Fit and Fill apply", async ({
    baseURL,
    page,
  }) => {
    await examOfThree(page, baseURL);
    const slider = page.getByRole("slider", { name: "Zoom" });
    const track = page.locator('[data-slot="slider-track"]');
    expect((await track.boundingBox())?.width ?? 0).toBeGreaterThan(120);
    // The shared track draws as every field does: a hairline of the input colour around the
    // page's background, so the slider reads as a control beside its fields.
    const drawn = await track.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderTopWidth,
        page: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(drawn.border).toBe("1px");
    expect(drawn.background).toBe(drawn.page);
    await slider.focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("button", { name: "Zoom options" })).toHaveText(
      "200%"
    );
    expect(await columnZoom(page)).toBeCloseTo(2);

    const options = page.getByRole("button", { name: "Zoom options" });
    for (const preset of [150, 100, 75, 50]) {
      await options.click();
      await page
        .getByRole("menuitemradio", { exact: true, name: `${preset}%` })
        .click();
      await expect(options).toHaveText(`${preset}%`);
      expect(await columnZoom(page)).toBeCloseTo(preset / 100);
    }
    await options.click();
    await page.getByRole("menuitemradio", { name: "Fill" }).click();
    await expect.poll(() => columnZoom(page)).toBeGreaterThan(1);
    await options.click();
    await expect(
      page.getByRole("menuitemradio", { name: "Fill" })
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitemradio", { name: "Fit" }).click();
    await expect(options).toHaveText("100%");
    expect(await columnZoom(page)).toBeCloseTo(1);
  });

  test("the counter jumps to the question typed, and the pages strip toggles and goes to a page", async ({
    baseURL,
    page,
  }) => {
    await examOfThree(page, baseURL);
    await page.getByRole("button", { name: ANY_OF_THREE }).click();
    const field = page.getByRole("spinbutton", {
      name: "Go to question, 1 to 3",
    });
    await expect(field).toBeFocused();
    await field.fill("1");
    await field.press("Enter");
    await expect(
      page.getByRole("button", { name: FIRST_OF_THREE })
    ).toBeVisible();

    const strip = page.getByRole("navigation", { name: "Pages" });
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await expect(strip.getByRole("button")).toHaveCount(3);
    await strip.getByRole("button", { name: THIRD_THUMBNAIL }).click();
    await expect(
      page.getByRole("button", { name: THIRD_OF_THREE })
    ).toBeVisible();
    await page.getByRole("button", { name: "Pages", exact: true }).click();
    await expect(strip).toHaveCount(0);
  });

  test("the grid replaces the canvas in place, the keys move between tiles, Enter opens one, a drag reorders for good, and Escape returns", async ({
    baseURL,
    page,
  }) => {
    const changes = await examOfThree(page, baseURL);
    await page.getByRole("button", { name: "Grid view" }).click();
    const grid = page.getByRole("region", { name: "Grid view" });
    await expect(grid).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Exam pages" })).toHaveCount(
      0
    );
    await expect(grid.getByRole("button", { name: OPEN_TILE })).toHaveCount(3);

    // The arrow keys move between the tiles, and Escape goes back to the pages.
    await grid.getByRole("button", { name: "Open question 1" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      grid.getByRole("button", { name: "Open question 2" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("region", { name: "Exam pages" })
    ).toBeVisible();

    // Enter on a tile opens its question on the canvas, as a click does on a phone below.
    await page.getByRole("button", { name: "Grid view" }).click();
    await grid.getByRole("button", { name: "Open question 3" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: THIRD_OF_THREE })
    ).toBeVisible();

    // A drag of the third tile onto the first moves it first, which a reload keeps.
    await page.getByRole("button", { name: "Grid view" }).click();
    const sentBefore = changes.sent;
    await grid
      .getByRole("listitem")
      .nth(2)
      .dragTo(grid.getByRole("listitem").first());
    await saved(changes, sentBefore);
    await page.reload();
    await expect(page.getByRole("region", { name: FIRST_PAGE })).toContainText(
      "Soal tiga",
      { timeout: readinessTimeoutMilliseconds }
    );
  });

  test("the grid duplicates and deletes the selected questions, and rolls a refused delete back", async ({
    baseURL,
    page,
  }) => {
    const changes = await examOfThree(page, baseURL);
    await page.getByRole("button", { name: "Grid view" }).click();
    const grid = page.getByRole("region", { name: "Grid view" });
    const tiles = grid.getByRole("button", { name: OPEN_TILE });

    await grid.getByRole("checkbox", { name: "Select question 1" }).click();
    await grid.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(tiles).toHaveCount(4);

    await grid.getByRole("checkbox", { name: "Select question 2" }).click();
    changes.failNext(REMOVE);
    await grid.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(tiles).toHaveCount(4);

    await grid.getByRole("checkbox", { name: "Select question 2" }).click();
    await grid.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(tiles).toHaveCount(3);
  });

  test("full screen enters and leaves", async ({ baseURL, page }) => {
    await examOfThree(page, baseURL);
    const button = page.getByRole("button", { name: "Full screen" });
    await button.click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(true);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(false);
  });
});

test.describe("at 390", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("a phone keeps the counter, the strip and the grid, which opens in place at two columns", async ({
    baseURL,
    page,
  }) => {
    await examOfThree(page, baseURL);
    await expect(page.getByRole("slider", { name: "Zoom" })).toBeHidden();
    await page.getByRole("button", { name: "Grid view" }).click();
    const grid = page.getByRole("region", { name: "Grid view" });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const columns = await grid
      .getByRole("list")
      .evaluate(
        (list) => getComputedStyle(list).gridTemplateColumns.split(" ").length
      );
    expect(columns).toBe(2);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    ).toBe(0);
    await grid.getByRole("button", { name: "Open question 2" }).click();
    await expect(
      page.getByRole("button", { name: SECOND_OF_THREE })
    ).toBeVisible();
  });
});
