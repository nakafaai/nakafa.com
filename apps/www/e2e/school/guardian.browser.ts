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

test("an admin links a parent, who signs in with the email code, opens the child beside the list, checks the NISN, reads the child, and withdraws consent", async ({
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
  const signIn = home.getByRole("button", { name: "Sign in" });
  const pressed = await signIn.boundingBox();
  await signIn.click();
  await expect(home.locator("form").getByRole("alert")).toHaveText(
    "The code is wrong or has expired."
  );
  // Each message takes the line kept for it, so the form never moves the button it answers.
  expect((await signIn.boundingBox())?.y).toBe(pressed?.y);
  await home.getByLabel("Sign-in code").fill(seeded.code);
  await home.getByRole("button", { name: "Sign in" }).click();

  const open = home.getByRole("button", { name: "Siswa Uji" });
  await expect(open).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(open);
  await open.click();
  const child = home.locator("[data-child]");
  await expect(child).toHaveAttribute("data-child", "pending");
  await expect(child.getByRole("heading", { name: "Siswa Uji" })).toBeVisible();
  await waitUntilTakenOver(child.getByLabel("Child's NISN"));
  await child.getByLabel("Child's NISN").fill("9999999999");
  const field = child.locator('[data-slot="field"]');
  const typed = await field.boundingBox();
  await child.getByRole("button", { name: "Check" }).click();
  await expect(child.getByRole("alert")).toHaveText(
    "The details do not match, check them or contact the school."
  );
  // The hint stays, and the refusal takes the line under it that the field kept from the start.
  await expect(
    field.getByText("Enter your child's NISN to confirm this link.")
  ).toBeVisible();
  expect((await field.boundingBox())?.height).toBe(typed?.height);
  await child.getByLabel("Child's NISN").fill(NISN);
  await child.getByRole("button", { name: "Check" }).click();
  await expect(child).toHaveAttribute("data-child", "verified");
  await expect(child.getByText("No grade is released yet.")).toBeVisible();

  await settings.reload();
  await expect(row).toContainText("Verified");

  await child.getByRole("button", { name: "Withdraw consent" }).click();
  await home
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw consent" })
    .click();
  await expect(child).toHaveAttribute("data-child", "withdrawn");
  await expect(child.getByText("You withdrew consent.")).toBeVisible();

  await settings.reload();
  await expect(row).toContainText("Withdrawn");
  await admin.close();
  await parent.close();
});
