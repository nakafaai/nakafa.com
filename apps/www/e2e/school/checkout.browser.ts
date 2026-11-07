import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  payInvoice,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** Max for 6 months with 37 added accounts, before tax: 7.990.000 and 37 times 15.900 a month, 6 months, 3 percent off. */
const MAX_HALF_YEAR_TOTAL = /49\.925\.706/u;

/** The number Nakafa gives each invoice. */
const INVOICE_NUMBER = /^NKF-\d{4}-\d{6}$/u;

/** The hosted page Xendit opens for the invoice's session. */
const HOSTED_PAGE =
  /^https:\/\/checkout-staging\.xendit\.co\/sessions\/ps_acceptance_NKF-/u;

/** Max holds 500 accounts, and the order adds 37. */
const ACCOUNTS_HELD = /of 537 accounts in use/u;

/** Keeps a picture of the page at a desktop and a phone width, light and dark, for the review of its design. */
async function picture(page: Page, state: string) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ height: 900, width });
      await page.screenshot({
        fullPage: true,
        path: test
          .info()
          .outputPath(`checkout-${state}-${colorScheme}-${width}.png`),
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ height: 900, width: 1440 });
}

test("an owner chooses Max for six months with 37 added accounts, pays the invoice on Xendit's hosted page, and the school shows Max", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/billing"));
  const planTitle = page.locator('[data-slot="card-title"]').first();
  await expect(planTitle).toHaveText("Trial");

  const choose = page.getByRole("button", { name: "Choose plan" });
  await waitUntilTakenOver(choose);
  await choose.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Max", { exact: true }).click();
  await dialog.getByRole("combobox", { name: "Period" }).click();
  await page.getByRole("option", { name: "6 months, 3 percent off" }).click();
  const accounts = dialog.getByLabel("Added accounts, optional");
  await accounts.fill("37");
  await accounts.press("Tab");
  await expect(accounts).toHaveValue("37");
  await expect(dialog.getByText(MAX_HALF_YEAR_TOTAL)).toBeVisible();
  await page.setViewportSize({ height: 900, width: 390 });
  await page.screenshot({
    path: test.info().outputPath("checkout-order-light-390.png"),
  });
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.screenshot({
    path: test.info().outputPath("checkout-order-light-1440.png"),
  });
  await dialog.getByRole("button", { name: "Issue invoice" }).click();
  await expect(dialog).toBeHidden();

  // The invoice holds no hosted page until Xendit answers, so it reads its number for a transfer meanwhile.
  await page.getByRole("button", { name: "View invoices" }).click();
  const sheet = page.getByRole("dialog");
  const invoice = sheet.getByRole("cell", { name: INVOICE_NUMBER });
  await expect(invoice).toBeVisible();
  const number = (await invoice.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await Effect.runPromise(payInvoice(number, "open"));
  const pay = page.getByRole("link", { exact: true, name: "Pay" });
  await expect(pay).toHaveAttribute("href", HOSTED_PAGE);
  await expect(pay).toHaveAttribute("target", "_blank");
  await picture(page, "open");

  await Effect.runPromise(payInvoice(number, "paid"));
  await expect(planTitle).toHaveText("Max");
  await expect(page.getByText(ACCOUNTS_HELD)).toBeVisible();
  await expect(pay).toBeHidden();
  await page.getByRole("button", { name: "View invoices" }).click();
  await expect(
    page.getByRole("dialog").getByRole("cell", { name: "Paid" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await picture(page, "paid");
  await context.close();
});
