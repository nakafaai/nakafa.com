import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { MutableList } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";

/** The search button of the sidebar, in English. */
const SEARCH = "Search content...";
/**
 * The first subject group the command menu lists before a query, in English:
 * the subject menu holds the high school grades only.
 */
const SUBJECT_GROUP = en.Subject["high-school"];

/**
 * The search command of the learning shell names the subjects in its first
 * groups. The shell loads the subject messages with its own, so the menu shows
 * every label and the page reports no missing message.
 */
test("the shell's search command lists the subjects with their names", async ({
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
    .poll(() =>
      search.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
    )
    .toBe(true);
  await search.click();

  await expect(
    page.getByRole("dialog").getByText(SUBJECT_GROUP, { exact: true })
  ).toBeVisible();
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
    .poll(() =>
      trigger.evaluate((node) =>
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      )
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
