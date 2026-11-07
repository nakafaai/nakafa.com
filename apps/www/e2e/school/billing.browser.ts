import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import {
  createSchool,
  grantStudent,
  hostAddress,
  inviteLearner,
  recordTransfer,
  signInOwner,
} from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A bank transfer opens the mail client, addressed to Nakafa. */
const MAILTO_LINK = /^mailto:/u;

/** Pro for 12 months with 10 added accounts, before tax: Rp20.406.000 and 10 times Rp181.260. */
const PRO_YEAR_TOTAL = /22\.218\.600/u;

/** The number Nakafa gives each invoice. */
const INVOICE_NUMBER = /^NKF-\d{4}-\d{6}$/u;

/** The widths the billing page is checked at: a phone, a tablet and a desktop. */
const WIDTHS = [390, 768, 1440] as const;

/** Keeps a picture of the page at each width, for the review of its design. */
async function picture(page: Page, state: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`billing-${state}-${width}.png`),
    });
  }
}

test("an owner orders Pro with added accounts by invoice, and the school shows Pro once the transfer is recorded", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  // Ani stays signed in on the main site, where her credits card shows the school's pool once it is paid.
  const ani = await browser.newContext();
  for (const name of ["ani", "budi"]) {
    const learner = `${name}-${school.slug}@acceptance.example.test`;
    const learnerContext = name === "ani" ? ani : await browser.newContext();
    await Effect.runPromise(
      inviteLearner({
        address: learner,
        baseURL: name === "ani" ? `${baseURL}/` : address("/"),
        context: learnerContext,
        slug: school.slug,
      })
    );
    await Effect.runPromise(grantStudent(school.slug, learner));
    if (learnerContext !== ani) {
      await learnerContext.close();
    }
  }
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();
  const changes = await Effect.runPromise(trackChanges(page, []));

  await page.goto(address("/settings/billing"));
  const planTitle = page.locator('[data-slot="card-title"]').first();
  await expect(planTitle).toHaveText("Trial");
  await expect(page.getByText("The school has no invoice yet.")).toBeVisible();
  await picture(page, "trial");

  const choose = page.getByRole("button", { name: "Choose plan" });
  await waitUntilTakenOver(choose);
  await choose.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Pro", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Max", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "+10" }).click();
  // Pro for 12 months at 5 percent off, with 10 added accounts at Rp181.260 each.
  await expect(dialog.getByText(PRO_YEAR_TOTAL)).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("billing-dialog-1440.png"),
  });
  await dialog.getByRole("button", { name: "Issue invoice" }).click();

  await expect(
    page.getByRole("link", { name: "Pay by transfer" })
  ).toHaveAttribute("href", MAILTO_LINK);
  await picture(page, "invoice");
  await page.getByRole("button", { name: "View invoices" }).click();
  const sheet = page.getByRole("dialog");
  const invoice = sheet.getByRole("cell", { name: INVOICE_NUMBER });
  await expect(invoice).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("billing-invoices-1440.png"),
  });
  const number = (await invoice.textContent()) ?? "";
  await Effect.runPromise(recordTransfer(number, `BCA-${school.slug}`));
  await expect(sheet.getByRole("cell", { name: "Paid" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(planTitle).toHaveText("Pro");
  // 110 paid accounts hold 6 AI credits each a month in the school's pool.
  await expect(page.getByText("0 of 660 used this month")).toBeVisible();
  await picture(page, "paid");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.screenshot({
    fullPage: true,
    path: test.info().outputPath("billing-paid-dark-1440.png"),
  });
  await page.emulateMedia({ colorScheme: "light" });

  await page.goto(address("/settings/policies"));
  const cap = page.getByRole("combobox", { name: "Nina credits a day" });
  await waitUntilTakenOver(cap);
  await expect(cap).toHaveText("50 credits");
  await cap.click();
  const sentBefore = changes.sent;
  await page.getByRole("option", { name: "100 credits" }).click();
  await expect(cap).toHaveText("100 credits");
  // The cap answers at once, and a reload would cancel a save still on its way.
  await saved(changes, sentBefore);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Nina credits a day" })
  ).toHaveText("100 credits");
  await picture(page, "policies");
  await context.close();

  const student = await ani.newPage();
  await student.goto("/en/user/settings/subscriptions");
  await expect(student.getByText("School credits today")).toBeVisible();
  await expect(student.getByText("0% used")).toBeVisible();
  await expect(
    student.getByText("Your school gives you these credits every day.")
  ).toBeVisible();
  await picture(student, "student");
  await ani.close();
});
