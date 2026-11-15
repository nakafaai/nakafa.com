import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { MutableList } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";

/** The search button of the sidebar, in English. */
const SEARCH = "Search content...";

/**
 * How long a lesson may take to hydrate. WebKit and Firefox take longer than
 * Chromium on a loaded machine, and a press before hydration is lost.
 */
const HYDRATED_WITHIN = 15_000;

/** The last row of a query, which searches inside every lesson. */
const FULL_SEARCH = /Search lessons for "mathematcs"/u;

/** A curriculum page, where the subject the typo found lives. */
const CURRICULUM_PAGE = /\/en\/curriculum\//u;

/**
 * The palette opens on the subjects around the lesson on screen and each
 * family's way in, read from the static index, and a query with a typo finds
 * the subject first, with its path. Every label is a message the shell loads,
 * so the page reports no missing message.
 */
test("the shell's palette suggests from the page and finds a subject through a typo", async ({
  page,
}) => {
  const missing = MutableList.make<string>();
  page.on("console", (message) => {
    if (message.text().includes("MISSING_MESSAGE")) {
      MutableList.append(missing, message.text());
    }
  });

  await page.goto(LESSON_PATH);
  const search = page.getByRole("button", { name: SEARCH }).first();
  await expect(search).toBeVisible();
  await expect
    .poll(
      () =>
        search.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$"))
        ),
      { timeout: HYDRATED_WITHIN }
    )
    .toBe(true);
  await search.click();

  const palette = page.getByRole("dialog", { name: "Search" });
  await expect(
    palette.getByText(en.Utils["search-near"], { exact: true })
  ).toBeVisible();
  await expect(
    palette.getByText(en.Utils["search-explore"], { exact: true })
  ).toBeVisible();

  await palette.getByRole("combobox").fill("mathematcs");
  const first = palette.getByRole("option").first();
  await expect(first).toContainText("Mathematics");
  await expect(
    palette.getByText(en.Utils["search-group-curricula"], { exact: true })
  ).toBeVisible();
  await expect(
    palette.getByRole("option", { name: FULL_SEARCH })
  ).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(CURRICULUM_PAGE);
  expect(MutableList.toArray(missing)).toEqual([]);
});

/**
 * Search lives in the phone's sidebar. The sheet steps aside for the palette, so
 * the row a learner picks opens on the page instead of behind the sidebar.
 */
test("a row picked in the phone's search opens with the sidebar out of the way", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(LESSON_PATH);
  const trigger = page.getByRole("button", { name: "Toggle Sidebar" }).first();
  await expect(trigger).toBeVisible();
  await expect
    .poll(
      () =>
        trigger.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$"))
        ),
      { timeout: HYDRATED_WITHIN }
    )
    .toBe(true);
  await trigger.click();
  const sidebar = page.getByRole("dialog", { name: "Sidebar" });
  await sidebar.getByRole("button", { name: SEARCH }).click();

  const palette = page.getByRole("dialog", { name: "Search" });
  await expect(palette.getByRole("combobox")).toBeFocused();
  await expect(sidebar).toBeHidden();

  await palette.getByRole("option").first().click();
  await expect(page).not.toHaveURL(new RegExp(`${LESSON_PATH}$`, "u"));
  await expect(palette).toBeHidden();
  await expect(sidebar).toBeHidden();
  await expect(page.locator("h1").first()).toBeVisible();
});
