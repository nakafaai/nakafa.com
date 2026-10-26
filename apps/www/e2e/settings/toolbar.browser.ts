import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { EMPTY, editorOf, opened, openMemoryPage } from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * Reads, for each group of the toolbar's row, how many buttons it holds outside
 * a group of toggles: a group holds two at most, a group of toggles, or a menu.
 */
function readLooseButtons(page: Page) {
  return page
    .getByRole("toolbar")
    .locator("[data-group]")
    .evaluateAll((groups) =>
      groups.map(
        (group) =>
          Array.from(group.querySelectorAll("button")).filter(
            (button) => button.closest('[data-slot="toggle-group"]') === null
          ).length
      )
    );
}

/**
 * Opens a new memory on a wide screen and proves its toolbar: the marks are one
 * group of toggles, no group holds more than two loose buttons, and the lists
 * and the blocks to insert are menus whose items act on the text.
 */
const verifyToolbar = Effect.fn("NakafaE2E.verifyMemoryToolbar")(function* (
  page: Page,
  baseURL: string
) {
  yield* openMemoryPage(page, baseURL);

  yield* Effect.promise(async () => {
    const editor = editorOf(page);
    const toolbar = page.getByRole("toolbar");

    await expect(page.getByText(EMPTY)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.getByRole("button", { name: "Add memory" }).click();
    await opened(page, "");

    await expect(
      toolbar.getByRole("group").getByRole("button", { name: "Bold" })
    ).toBeVisible();
    expect(Math.max(...(await readLooseButtons(page)))).toBeLessThanOrEqual(2);

    await toolbar.getByRole("button", { exact: true, name: "Lists" }).click();
    await page
      .getByRole("menuitemcheckbox", { exact: true, name: "Task list" })
      .click();
    await expect(editor).toBeFocused();
    await page.keyboard.type("Read chapter one");
    await expect(editor.locator('ul[data-type="taskList"] li')).toHaveText(
      "Read chapter one"
    );

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await toolbar
      .getByRole("button", { exact: true, name: "Insert a block" })
      .click();
    await page.getByRole("menuitem", { exact: true, name: "Divider" }).click();
    await expect(editor.locator("hr")).toHaveCount(1);
  });
});

test.describe("Memory editor toolbar at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("groups the marks, and keeps the lists and blocks in menus", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyToolbar(page, origin))
        )
      )
    );
  });
});
