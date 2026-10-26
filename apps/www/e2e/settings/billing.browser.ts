import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The billing settings of the signed-in learner. */
const SUBSCRIPTIONS = "/en/user/settings/subscriptions";

/** The widths the billing settings are checked at: a phone, a tablet and a desktop. */
const WIDTHS = [390, 768, 1440] as const;

// A browser in Jakarta shows rupiah, which the local runtime sells through Xendit.
test.use({ timezoneId: "Asia/Jakarta" });

/** Keeps a picture of the page at each width, for the review of its design. */
async function picture(page: Page, state: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`checkout-${state}-${width}.png`),
    });
  }
}

/** Keeps a picture of the open dialog in light and dark at the desktop width. */
async function pictureDialog(page: Page, state: string) {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.screenshot({
    path: test.info().outputPath(`checkout-${state}-1440.png`),
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: test.info().outputPath(`checkout-${state}-dark-1440.png`),
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ height: 800, width: 390 });
  await page.screenshot({
    path: test.info().outputPath(`checkout-${state}-390.png`),
  });
}

test("a learner in Indonesia chooses the monthly plan or a pass, each in rupiah", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openChatPage(page, origin);
      yield* Effect.promise(async () => {
        await page.goto(SUBSCRIPTIONS);
        const upgrade = page.getByRole("button", { name: "Upgrade" });
        await waitUntilTakenOver(upgrade);
        await upgrade.click();
        const dialog = page.getByRole("dialog", { name: "Choose how to pay" });
        await expect(
          dialog.getByText("Monthly", { exact: true })
        ).toBeVisible();
        for (const months of [1, 3, 12]) {
          await expect(
            dialog.getByText(`${months}-month pass`, { exact: true })
          ).toBeVisible();
        }
        await expect(dialog.getByText("Rp 229.000")).toBeVisible();
        await pictureDialog(page, "offers");
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toBeHidden();
      });
    })
  );
});

test("a pass holder sees when the pass ends, extends it with passes only, and finds the receipt", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      yield* runAcceptanceCommand("xendit", learner.userId, "pass");
      yield* Effect.promise(async () => {
        await page.goto(SUBSCRIPTIONS);
        await expect(page.getByText("Your Pro pass runs until")).toBeVisible();
        const receipts = page.getByRole("table");
        await expect(
          receipts.getByRole("cell", { name: "Pro pass" })
        ).toBeVisible();
        await expect(
          receipts.getByRole("cell", { name: "Rp 79.000" })
        ).toBeVisible();
        await picture(page, "pass");
        const extend = page.getByRole("button", { name: "Extend Pro" });
        await waitUntilTakenOver(extend);
        await extend.click();
        const dialog = page.getByRole("dialog", { name: "Choose how to pay" });
        await expect(dialog.getByText("3-month pass")).toBeVisible();
        await expect(dialog.getByText("Monthly", { exact: true })).toHaveCount(
          0
        );
        await pictureDialog(page, "extend");
      });
    })
  );
});

test("a Xendit subscriber cancels the plan in the settings, and it ends with its paid month", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      yield* runAcceptanceCommand("xendit", learner.userId, "plan");
      yield* Effect.promise(async () => {
        await page.goto(SUBSCRIPTIONS);
        await expect(page.getByText("Xendit", { exact: true })).toBeVisible();
        await expect(
          page.getByRole("cell", { name: "Pro subscription" })
        ).toBeVisible();
        await picture(page, "subscribed");
        const cancel = page.getByRole("button", { name: "Cancel plan" });
        await waitUntilTakenOver(cancel);
        await cancel.click();
        const dialog = page.getByRole("dialog", { name: "Cancel Pro?" });
        await expect(
          dialog.getByText("nothing is charged after it")
        ).toBeVisible();
        await pictureDialog(page, "cancel");
        await page.setViewportSize({ height: 900, width: 1440 });
        await dialog.getByRole("button", { name: "Cancel plan" }).click();
        await expect(
          page.getByText("Nothing is charged after this period.")
        ).toBeVisible();
        await expect(page.getByText("Ends on")).toBeVisible();
        await picture(page, "ending");
      });
    })
  );
});
