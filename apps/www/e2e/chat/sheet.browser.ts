import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openSheet } from "@/e2e/support/sheet";

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
});
