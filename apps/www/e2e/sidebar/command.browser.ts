import { expect, test } from "@playwright/test";
import { MutableList } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";

/** The search button of the sidebar, in English. */
const SEARCH = "Search content...";
/** The first subject group the command menu lists before a query, in English. */
const SUBJECT_GROUP = "Elementary School";

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
