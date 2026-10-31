import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

test("an owner gives a client a webhook, reads its secret once, edits it, reads its log, and revokes it", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext();
  await Effect.runPromise(signInOwner(context, school.slug, address("/")));
  const page = await context.newPage();

  await page.goto(address("/settings/clients"));
  const addClient = page
    .locator("header")
    .getByRole("button", { name: "Create client" });
  await waitUntilTakenOver(addClient);
  await addClient.click();
  const clientDialog = page.getByRole("dialog");
  await clientDialog.getByLabel("Name").fill("Sistem Sekolah");
  await clientDialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog", { name: "New secret" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(address("/settings/webhooks"));
  await expect(page.getByText("No webhook sends changes yet.")).toBeVisible();
  await page
    .locator("header")
    .getByRole("button", { name: "Create webhook" })
    .click();
  const dialog = page.getByRole("dialog");
  const create = dialog.getByRole("button", { name: "Create" });
  await dialog.getByRole("combobox", { name: "Client" }).click();
  await page.getByRole("option", { name: "Sistem Sekolah" }).click();

  // A private or a plain address is refused where it is typed.
  await dialog.getByLabel("Receiver address").fill("http://10.0.0.8/hook");
  await expect(dialog.getByText("Use a public https address.")).toBeVisible();
  await expect(create).toBeDisabled();

  await dialog.getByLabel("Receiver address").fill("https://93.184.216.34/a");
  await expect(dialog.getByRole("checkbox", { name: "Unit created" })).toBeChecked();
  await create.click();
  await expect(
    page.getByRole("dialog", { name: "Signing secret" })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const row = page.getByRole("row").filter({ hasText: "Sistem Sekolah" });
  await expect(row).toContainText("https://93.184.216.34/a");
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit" });
  await edit.getByLabel("Receiver address").fill("https://93.184.216.34/b");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(row).toContainText("https://93.184.216.34/b");

  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Deliveries" }).click();
  await expect(page.getByText("No change has been sent yet.")).toBeVisible();
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Revoke" }).click();
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(row).toContainText("Revoked");
  await context.close();
});
