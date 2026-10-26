import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
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

test("an owner upgrades a free school by invoice, and the school shows School once the transfer is recorded", async ({
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

  await page.goto(address("/settings/billing"));
  const planTitle = page.locator('[data-slot="card-title"]').first();
  await expect(planTitle).toHaveText("Free");
  await expect(
    page.getByText("Up to 100 students, with every School feature.")
  ).toBeVisible();
  await expect(page.getByText("The school has no invoice yet.")).toBeVisible();
  await picture(page, "free");

  const upgrade = page.getByRole("button", { name: "Upgrade" });
  await waitUntilTakenOver(upgrade);
  await upgrade.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("This semester")).toBeVisible();
  await expect(dialog.getByText("This school year")).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("billing-dialog-1440.png"),
  });
  await dialog.getByText("This school year").click();
  await dialog.getByRole("button", { name: "Issue invoice" }).click();

  const invoice = page.getByRole("cell", { name: INVOICE_NUMBER });
  await expect(invoice).toBeVisible();
  await picture(page, "invoice");
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Pay by transfer" })
  ).toHaveAttribute("href", MAILTO_LINK);
  await page.screenshot({
    path: test.info().outputPath("billing-invoice-menu-1440.png"),
  });
  await page.keyboard.press("Escape");

  const number = (await invoice.textContent()) ?? "";
  await Effect.runPromise(recordTransfer(number, `BCA-${school.slug}`));
  await expect(planTitle).toHaveText("School");
  await expect(page.getByRole("cell", { name: "Paid" })).toBeVisible();
  await expect(page.getByText("Every student is paid for.")).toBeVisible();
  // Two paid students hold 100 Nina credits each a month in the school's pool.
  await expect(page.getByText("0 of 200 used")).toBeVisible();
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
  await page.getByRole("option", { name: "100 credits" }).click();
  await expect(cap).toHaveText("100 credits");
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
