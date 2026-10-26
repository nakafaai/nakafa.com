import { expect, type Page } from "@playwright/test";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** One person and one of the school's roles, as the Roles page names them. */
interface RoleOf {
  readonly person: string;
  readonly role: string;
}

/** The row of the Roles page that holds the person's grant of the role. */
function grantRow(page: Page, { person, role }: RoleOf) {
  return page
    .getByRole("row")
    .filter({ hasText: person })
    .filter({ has: page.getByRole("cell", { exact: true, name: role }) });
}

/**
 * Gives the person the role from the Roles page that `page` shows, through the header's
 * Give role dialog, and waits until the grant's row appears.
 */
export async function giveRole(page: Page, grant: RoleOf) {
  const give = page
    .locator("header")
    .getByRole("button", { name: "Give role" });
  await waitUntilTakenOver(give);
  await give.click();
  const dialog = page.getByRole("dialog", { name: "Give a role" });
  await dialog.getByRole("combobox", { name: "Person" }).click();
  await page.getByRole("option", { name: grant.person }).click();
  await dialog.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { exact: true, name: grant.role }).click();
  await dialog.getByRole("button", { name: "Give role" }).click();
  await expect(grantRow(page, grant)).toBeVisible();
}

/** Revokes the person's grant of the role from the Roles page that `page` shows, behind its confirmation. */
export async function revokeRole(page: Page, grant: RoleOf) {
  const more = grantRow(page, grant).getByRole("button", {
    name: "More actions",
  });
  await waitUntilTakenOver(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Revoke" }).click();
  await page
    .getByRole("dialog", { name: "Revoke this role?" })
    .getByRole("button", { name: "Revoke" })
    .click();
}
