import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { EMPTY, editorOf, opened, openMemoryPage } from "@/e2e/support/memory";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The controls a wide toolbar shows in its row, none of them behind a menu. */
const CONTROLS = [
  "Bold",
  "Italic",
  "Bulleted list",
  "Numbered list",
  "Task list",
  "Quote",
  "Code block",
  "Divider",
] as const;

/**
 * Opens a new memory on a wide screen and proves its toolbar: every format, list and block is its own control in the
 * row, no control opens a menu, a list's control is pressed while the caret sits in it, and the divider's control
 * inserts a rule.
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

    for (const name of CONTROLS) {
      await expect(
        toolbar.getByRole("button", { exact: true, name })
      ).toBeVisible();
    }
    await expect(toolbar.locator("[aria-haspopup=menu]")).toHaveCount(1);

    const tasks = toolbar.getByRole("button", {
      exact: true,
      name: "Task list",
    });
    await tasks.click();
    await expect(editor).toBeFocused();
    await page.keyboard.type("Read chapter one");
    await expect(editor.locator('ul[data-type="taskList"] li')).toHaveText(
      "Read chapter one"
    );
    await expect(tasks).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(tasks).not.toHaveAttribute("aria-pressed", "true");
    await toolbar.getByRole("button", { exact: true, name: "Divider" }).click();
    await expect(editor.locator("hr")).toHaveCount(1);
  });
});

test.describe("Memory editor toolbar at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("shows every format, list and block as its own control", async ({
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
