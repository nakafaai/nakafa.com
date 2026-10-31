import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { giveRole } from "@/e2e/support/roles";
import {
  createSchool,
  hostAddress,
  inviteLearner,
  signInClassTeacher,
  signInOwner,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The name of every learner the acceptance runtime invites. */
const LEARNER = "Acceptance Learner";

/** Opens the row menu of the row that holds `text`, once the page has taken it over. */
async function openRowMenu(page: Page, text: string) {
  const more = page
    .getByRole("row")
    .filter({ hasText: text })
    .getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(more);
  await more.click();
}

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`an owner changes a role in one step, corrects an invite's email, edits an API client, and moves the school's country, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const learnerContext = await browser.newContext({ viewport });
    await Effect.runPromise(
      inviteLearner({
        address: `role-${viewport.width}-${school.slug}@acceptance.example.test`,
        baseURL: address("/"),
        context: learnerContext,
        slug: school.slug,
      })
    );
    await learnerContext.close();
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInOwner(context, school.slug, address("/")));
    const page = await context.newPage();
    const changes = await Effect.runPromise(trackChanges(page, []));

    // The Integration role belongs to a client, so a person is never offered it.
    await page.goto(address("/settings/roles"));
    await giveRole(page, { person: LEARNER, role: "Staff" });
    await openRowMenu(page, LEARNER);
    await page.getByRole("menuitem", { name: "Change role" }).click();
    const roleDialog = page.getByRole("dialog", { name: "Change role" });
    await roleDialog.getByRole("combobox", { name: "Role" }).click();
    await expect(page.getByRole("option", { name: "Integration" })).toHaveCount(
      0
    );
    await page.getByRole("option", { exact: true, name: "Counselor" }).click();
    await roleDialog.getByRole("button", { name: "Save" }).click();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: LEARNER })
        .getByRole("cell", { exact: true, name: "Counselor" })
    ).toBeVisible();

    await page.goto(address("/settings/invites"));
    const inviteAction = page
      .locator("header")
      .getByRole("button", { exact: true, name: "Invite" });
    await waitUntilTakenOver(inviteAction);
    await inviteAction.click();
    const invite = page.getByRole("dialog");
    await invite.getByLabel("Name", { exact: true }).fill("Guru Salah Ketik");
    await invite
      .getByLabel("Email", { exact: true })
      .fill("guru@harapan.example.tes");
    await invite.getByRole("button", { exact: true, name: "Invite" }).click();
    await openRowMenu(page, "Guru Salah Ketik");
    await page.getByRole("menuitem", { name: "Change email" }).click();
    const email = page.getByRole("dialog", { name: "Change email" });
    await email.getByLabel("Email").fill("guru@harapan.example.test");
    await email.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "Guru Salah Ketik" })
    ).toContainText("guru@harapan.example.test");
    await page.reload();
    await expect(
      page.getByRole("row").filter({ hasText: "Guru Salah Ketik" })
    ).toHaveCount(1, { timeout: readinessTimeoutMilliseconds });

    await page.goto(address("/settings/clients"));
    const createClient = page
      .locator("header")
      .getByRole("button", { name: "Create client" });
    await waitUntilTakenOver(createClient);
    await createClient.click();
    const created = page.getByRole("dialog");
    await created.getByRole("textbox", { name: "Name" }).fill("Sinkron Lama");
    await created.getByRole("button", { name: "Create" }).click();
    await expect(
      page.getByRole("dialog", { name: "New secret" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await openRowMenu(page, "Sinkron Lama");
    await page.getByRole("menuitem", { name: "Edit client" }).click();
    const client = page.getByRole("dialog", { name: "Edit client" });
    await client.getByRole("textbox", { name: "Name" }).fill("Sinkron Baru");
    await client.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "Sinkron Baru" })
    ).toBeVisible();

    await page.goto(address("/settings/profile"));
    const country = page.getByRole("combobox", { name: "Country" });
    await waitUntilTakenOver(country);
    await country.click();
    await page.getByRole("option", { name: "Singapore" }).click();
    await expect(
      page.getByRole("combobox", { name: "Currency" })
    ).toContainText("SGD");
    const sentBefore = changes.sent;
    await page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Country and currency" })
      .getByRole("button", { name: "Save" })
      .click();
    // The reload waits for the server, since it would cancel a save still on its way.
    await saved(changes, sentBefore);
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Country" })).toContainText(
      "Singapore",
      { timeout: readinessTimeoutMilliseconds }
    );
    await context.close();
  });

  test(`a class teacher renames a topic channel and a discussion, and edits a library link, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const page = await context.newPage();

    await page.goto(address("/classes/fisika-x-1/forum"));
    const addChannel = page.getByRole("button", { name: "Add chat" });
    await waitUntilTakenOver(addChannel);
    await addChannel.click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Chat name" })
      .fill("Tugs");
    await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
    const channel = page.getByRole("link", { exact: true, name: "Tugs" });
    await expect(channel).toBeVisible();
    await page
      .getByRole("listitem")
      .filter({ has: channel })
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Rename chat" }).click();
    const rename = page.getByRole("dialog", { name: "Rename chat" });
    await rename.getByRole("textbox", { name: "Chat name" }).fill("Tugas");
    await rename.getByRole("button", { name: "Save" }).click();
    const renamed = page.getByRole("link", { exact: true, name: "Tugas" });
    await expect(renamed).toBeVisible();

    // The general channel keeps its name, because the page translates it.
    await page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { exact: true, name: "General" }) })
      .getByRole("button", { name: "More actions" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Rename chat" })
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto(address("/classes/fisika-x-1/library"));
    const add = page.getByRole("button", { name: "Add to library" });
    await waitUntilTakenOver(add);
    await add.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Link" }).click();
    await dialog
      .getByRole("textbox", { name: "Address" })
      .fill("https://example.com/lama");
    await dialog.getByRole("textbox", { name: "Title" }).fill("Video lama");
    await dialog.getByRole("button", { exact: true, name: "Add" }).click();
    await expect(page.getByRole("link", { name: "Video lama" })).toBeVisible();
    await openRowMenu(page, "Video lama");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const edit = page.getByRole("dialog");
    await edit
      .getByRole("textbox", { name: "Address" })
      .fill("https://example.com/baru");
    await edit.getByRole("textbox", { name: "Title" }).fill("Video baru");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("link", { name: "Video baru" })
    ).toHaveAttribute("href", "https://example.com/baru");
    await context.close();
  });
}
