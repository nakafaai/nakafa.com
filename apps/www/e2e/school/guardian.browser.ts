import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedGuardianCode } from "@/e2e/support/guardian";
import {
  createSchool,
  hostAddress,
  seedCard,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The student's NISN that the seed writes on the roster. */
const NISN = "0012345678";

test("an admin links a parent, who signs in with the email code, checks the NISN, reads the child, and withdraws consent", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  await Effect.runPromise(seedCard(school.slug));
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const email = `ibu.${school.slug}@example.com`;

  const admin = await browser.newContext();
  await Effect.runPromise(signInOwner(admin, school.slug, address("/")));
  const settings = await admin.newPage();
  await settings.goto(address("/settings/guardians"));
  await expect(settings.getByText("No parent is linked yet.")).toBeVisible();
  const add = settings
    .locator("header")
    .getByRole("button", { name: "Link a parent" });
  await waitUntilTakenOver(add);
  await add.click();
  const dialog = settings.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Student" }).click();
  await settings.getByRole("option", { name: "Siswa Uji" }).click();
  await dialog.getByLabel("Parent's name").fill("Ibu Uji");
  await dialog.getByLabel("Parent email").fill(email);
  await dialog.getByRole("button", { name: "Link a parent" }).click();
  const row = settings.getByRole("row").filter({ hasText: "Siswa Uji" });
  await expect(row).toContainText(email);
  await expect(row).toContainText("Pending");

  const parent = await browser.newContext();
  const home = await parent.newPage();
  await home.goto(address("/orang-tua"));
  const send = home.getByRole("button", { name: "Send code" });
  await waitUntilTakenOver(send);
  await home.getByLabel("Parent email").fill(email);
  await send.click();
  await expect(home.getByLabel("Sign-in code")).toBeVisible();
  const seeded = await Effect.runPromise(
    seedGuardianCode(school.slug, email, NISN)
  );
  await home.getByLabel("Sign-in code").fill("000000");
  await home.getByRole("button", { name: "Sign in" }).click();
  await expect(home.locator("form").getByRole("alert")).toHaveText(
    "The code is wrong or has expired."
  );
  await home.getByLabel("Sign-in code").fill(seeded.code);
  await home.getByRole("button", { name: "Sign in" }).click();

  const child = home.locator('[data-slot="guardian-child"]');
  await expect(child).toHaveAttribute("data-status", "pending", {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(child.getByText("Siswa Uji")).toBeVisible();
  await child.getByLabel("Child's NISN").fill("9999999999");
  await child.getByRole("button", { name: "Check" }).click();
  await expect(child.getByRole("alert")).toHaveText(
    "The details do not match, check them or contact the school."
  );
  await child.getByLabel("Child's NISN").fill(NISN);
  await child.getByRole("button", { name: "Check" }).click();
  await expect(child).toHaveAttribute("data-status", "verified");
  await expect(child.getByText("No grade is released yet.")).toBeVisible();

  await settings.reload();
  await expect(row).toContainText("Verified");

  await child.getByRole("button", { name: "Withdraw consent" }).click();
  await home
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw consent" })
    .click();
  await expect(child).toHaveAttribute("data-status", "withdrawn");
  await expect(child.getByText("You withdrew consent.")).toBeVisible();

  await settings.reload();
  await expect(row).toContainText("Withdrawn");
  await admin.close();
  await parent.close();
});
