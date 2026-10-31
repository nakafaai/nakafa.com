import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
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

/** How many lines an element's text takes on screen. */
function lineCount(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  return new Set(
    Array.from(range.getClientRects(), (rect) => Math.round(rect.top))
  ).size;
}

test("an admin links a parent and corrects the mistyped email, the parent signs in with the email code, opens the child beside the list, checks the NISN, reads the child, and withdraws consent", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  await Effect.runPromise(seedCard(school.slug));
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const email = `ibu.${school.slug}@example.com`;
  const mistyped = `ibu.${school.slug}@exampel.com`;

  const admin = await browser.newContext();
  await Effect.runPromise(signInOwner(admin, school.slug, address("/")));
  const settings = await admin.newPage();
  const changes = await Effect.runPromise(trackChanges(settings, []));
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
  await dialog.getByLabel("Parent email").fill(mistyped);
  await dialog.getByRole("button", { name: "Link a parent" }).click();
  const row = settings.getByRole("row").filter({ hasText: "Siswa Uji" });
  await expect(row).toContainText(mistyped);
  await expect(row).toContainText("Pending");

  // The mistyped email is corrected in place, from a dialog filled in with it, and the link stays pending.
  await row.getByRole("button", { name: "More actions" }).click();
  await settings.getByRole("menuitem", { name: "Change email" }).click();
  const correction = settings.getByRole("dialog");
  const corrected = correction.getByLabel("Parent email");
  await expect(corrected).toHaveValue(mistyped);
  const saveEmail = correction.getByRole("button", { name: "Save email" });
  await expect(saveEmail).toBeDisabled();
  await corrected.fill(email);
  const readdressedBefore = changes.sent;
  await saveEmail.click();
  await expect(row).toContainText(email);
  await expect(row).toContainText("Pending");
  await saved(changes, readdressedBefore);

  // The parent's name is corrected the same way, and the row shows it at once.
  await row.getByRole("button", { name: "More actions" }).click();
  await settings.getByRole("menuitem", { name: "Rename parent" }).click();
  const naming = settings.getByRole("dialog");
  await naming.getByRole("textbox", { name: "Name" }).fill("Ibu Uji Baru");
  const renamedBefore = changes.sent;
  await naming.getByRole("button", { name: "Save" }).click();
  await expect(row).toContainText("Ibu Uji Baru");
  await saved(changes, renamedBefore);

  const parent = await browser.newContext();
  const home = await parent.newPage();
  await home.goto(address("/parents"));
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
    "These details don't match."
  );
  // The hint stays, and the refusal takes the line under it that the field kept from the start.
  await expect(
    field.getByText("Enter your child's NISN to confirm this link.")
  ).toBeVisible();
  expect((await field.boundingBox())?.height).toBe(typed?.height);
  // The refusal is one line, the one the field kept for it, so it never pushes the field taller.
  expect(await child.getByRole("alert").evaluate(lineCount)).toBe(1);
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
