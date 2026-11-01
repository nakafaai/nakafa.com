import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import { chooseDay } from "@/e2e/support/date";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The time line of an edited announcement. */
const EDITED = /, edited$/u;

/** A late evening time in the list, in the 12 or the 24 hour clock of the browser. */
const LATE_EVENING = /^(?:11:45\sPM|23:45)$/u;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a subject teacher posts an announcement on the class home, finds it after a reload, edits it and removes it, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const page = await context.newPage();
    const changes = await Effect.runPromise(trackChanges(page, []));
    await page.goto(address("/classes/fisika-x-1"));
    await expect(page.getByText("No announcement yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // The announcement shows at once first on the home, and the dialog closes.
    const create = page.getByRole("button", { name: "New announcement" });
    await waitUntilTakenOver(create);
    await create.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Announcement" })
      .fill("Ulangan bab 2 hari Senin pukul 07.30.");
    await dialog.getByRole("checkbox", { name: "Also send by email" }).click();
    const postedBefore = changes.sent;
    await dialog.getByRole("button", { name: "Post" }).click();
    await expect(dialog).toBeHidden();
    const posted = page.getByText("Ulangan bab 2 hari Senin pukul 07.30.");
    await expect(posted).toBeVisible();
    await expect(page.getByText("Also sent by email.")).toBeVisible();

    // The server keeps it, once it answered the post: a reload drops a change still on its way.
    await saved(changes, postedBefore);
    await page.reload();
    await expect(posted).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    // The author edits it in its place and removes it for good.
    const more = page.getByRole("button", { name: "More actions" });
    await waitUntilTakenOver(more);
    await more.click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page
      .getByRole("textbox", { name: "Edit" })
      .fill("Ulangan bab 2 pindah ke hari Selasa.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("Ulangan bab 2 pindah ke hari Selasa.")
    ).toBeVisible();
    await expect(page.getByText(EDITED)).toBeVisible();

    // A pinned announcement says so, and stays pinned through a reload until a teacher takes it down.
    await page.getByRole("button", { name: "More actions" }).click();
    const pinnedBefore = changes.sent;
    await page.getByRole("menuitem", { exact: true, name: "Pin" }).click();
    await expect(page.getByLabel("Pinned")).toBeVisible();
    await saved(changes, pinnedBefore);
    await page.reload();
    await expect(page.getByLabel("Pinned")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await waitUntilTakenOver(more);
    await more.click();
    await page.getByRole("menuitem", { name: "Unpin" }).click();
    await expect(page.getByLabel("Pinned")).toHaveCount(0);

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    const removedBefore = changes.sent;
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect(page.getByText("No announcement yet")).toBeVisible();
    await saved(changes, removedBefore);
    await page.reload();
    await expect(page.getByText("No announcement yet")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await context.close();
  });
}

test("a subject teacher keeps an announcement for later, which the class's posts do not show, moves it, and cancels it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/classes/fisika-x-1"));
  await expect(page.getByText("No announcement yet")).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  const create = page.getByRole("button", { name: "New announcement" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Announcement" }).fill("Ulangan.");
  await dialog.getByRole("checkbox", { name: "Post later" }).click();
  const send = dialog.getByRole("button", { name: "Schedule" });
  await expect(send).toBeDisabled();
  await chooseDay(page, dialog.getByLabel("Goes out at"), "2027-10-30");
  await dialog.getByRole("combobox", { name: "Time" }).click();
  await page.getByRole("option", { name: LATE_EVENING }).click();
  await send.click();
  await expect(dialog).toBeHidden();

  // It waits above the posts, and the class has none yet.
  const waiting = page.getByRole("list", { name: "Scheduled" });
  await expect(waiting).toContainText("Ulangan.");
  await expect(page.getByText("No announcement yet")).toBeVisible();

  const more = waiting.getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await dialog
    .getByRole("textbox", { name: "Announcement" })
    .fill("Ulangan lusa.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(waiting).toContainText("Ulangan lusa.");

  await more.click();
  await page.getByRole("menuitem", { name: "Cancel post" }).click();
  await expect(waiting).toHaveCount(0);
  await context.close();
});

test("a subject teacher asks a poll on the class home, votes, changes the vote, and removes it", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/classes/fisika-x-1"));
  const create = page.getByRole("button", { name: "New poll" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Question").fill("Ulangan hari apa?");
  await dialog.getByRole("textbox", { name: "Choice 1" }).fill("Senin");
  await dialog.getByRole("textbox", { name: "Choice 2" }).fill("Selasa");
  await dialog.getByRole("button", { name: "Send poll" }).click();
  await expect(page.getByText("Ulangan hari apa?")).toBeVisible();

  const monday = page.getByRole("button", { name: "Senin" });
  await expect(monday).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
  await monday.click();
  await expect(monday).toHaveAttribute("aria-pressed", "true");
  const tuesday = page.getByRole("button", { name: "Selasa" });
  await tuesday.click();
  await expect(tuesday).toHaveAttribute("aria-pressed", "true");
  await expect(monday).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(page.getByText("No announcement yet")).toBeVisible();
  await context.close();
});
