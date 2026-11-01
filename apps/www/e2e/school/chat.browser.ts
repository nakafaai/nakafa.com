import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of a thread of the class. */
const THREAD_PATH = /\/forum\/\d+/u;

/** The address of the class's list of chats. */
const FORUM_PATH = /\/forum$/u;

/** The smallest PNG, one transparent pixel, as a phone's photo stands for it here. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/** The leading bytes of a PDF, which is all the server reads of one. */
const PAPER = Buffer.from("%PDF-1.7\n1 0 obj\n");

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a teacher opens the forum on its chats, filters them, and sends a photo, a document, a poll, an emoji and a thread, at ${viewport.width} px`, async ({
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
    await Effect.runPromise(seedForum(school.slug, 4, 0));
    const page = await context.newPage();
    await page.goto(address("/classes/fisika-x-1/forum"));

    // The forum opens on its list of chats, each with the start of its newest message and an unread dot.
    const rail = page.getByRole("complementary", { name: "Chats" });
    // The link of a chat with unread messages also says so to a screen reader.
    const general = rail.getByRole("link", { name: "General" });
    await waitUntilTakenOver(general);
    await expect(
      page.getByRole("textbox", { name: "Write a message" })
    ).toHaveCount(0);

    // The filters keep the unread chats, then the class's threads.
    await rail.getByRole("tab", { name: "Unread" }).click();
    await expect(general).toBeVisible();
    await rail.getByRole("tab", { name: "Threads" }).click();
    await expect(rail.getByText("No results")).toBeVisible();
    await rail.getByRole("tab", { name: "All" }).click();
    await general.click();
    const field = page.getByRole("textbox", { name: "Write a message" });
    await waitUntilTakenOver(field);

    // A photo waits in the tray, and goes out with its caption.
    const add = page.getByRole("button", {
      name: "Add a photo, a document or a poll",
    });
    const choosePhoto = page.waitForEvent("filechooser");
    await add.click();
    await page.getByRole("menuitem", { name: "Photo" }).click();
    const photoChooser = await choosePhoto;
    await photoChooser.setFiles({
      buffer: PIXEL,
      mimeType: "image/png",
      name: "papan.png",
    });
    await expect(
      page.getByRole("button", { name: "Remove papan.png" })
    ).toBeVisible();
    await field.fill("Foto papan tulis");
    const send = page.getByRole("button", { exact: true, name: "Send" });
    await expect(send).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
    await send.click();
    await expect(
      page.getByRole("button", { name: "Open papan.png" })
    ).toBeVisible();
    await expect(
      page.getByText("Foto papan tulis", { exact: true })
    ).toBeVisible();

    // A document goes out alone, and shows as a row that opens it.
    const chooseDocument = page.waitForEvent("filechooser");
    await add.click();
    await page.getByRole("menuitem", { name: "Document" }).click();
    const documentChooser = await chooseDocument;
    await documentChooser.setFiles({
      buffer: PAPER,
      mimeType: "application/pdf",
      name: "soal.pdf",
    });
    await expect(send).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
    await send.click();
    await expect(page.getByRole("link", { name: "soal.pdf" })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // A poll shows at once, and a vote counts at once.
    await add.click();
    await page.getByRole("menuitem", { name: "Poll" }).click();
    const dialog = page.getByRole("dialog", { name: "New poll" });
    await dialog.getByLabel("Question").fill("Ulangan hari apa?");
    await dialog.getByRole("textbox", { name: "Choice 1" }).fill("Senin");
    await dialog.getByRole("textbox", { name: "Choice 2" }).fill("Selasa");
    await dialog.getByRole("button", { name: "Send poll" }).click();
    const monday = page.getByRole("button", { name: "Senin" });
    await expect(monday).toBeVisible();
    await expect(monday).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
    await monday.click();
    await expect(monday).toHaveAttribute("aria-pressed", "true");
    await expect(monday).toContainText("100%");
    await expect(page.getByText("1 vote")).toBeVisible();

    // An emoji reaches a message with one press, and a second press takes it back.
    const row = page.locator('[data-slot="message"]').filter({
      hasText: "Foto papan tulis",
    });
    await row.hover();
    await row.getByRole("button", { name: "React" }).click();
    await page.getByRole("button", { exact: true, name: "👍" }).first().click();
    const chip = row.getByRole("button", { name: "👍, 1" });
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await chip.click();
    await expect(chip).toHaveCount(0);

    // Any message starts a thread, titled by its first line.
    await row.hover();
    await row.getByRole("button", { name: "Reply in thread" }).click();
    await expect(page).toHaveURL(THREAD_PATH, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.getByText("Foto papan tulis").first()).toBeVisible();
    await context.close();
  });
}

test("a teacher archives a chat, which keeps its messages and takes no new one, restores it, and deletes it", async ({
  baseURL,
  browser,
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
  await page.goto(address("/classes/fisika-x-1/forum"));
  const add = page.getByRole("button", { name: "Add chat" });
  await waitUntilTakenOver(add);
  await add.click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Chat name" })
    .fill("Tugas");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  const rail = page.getByRole("complementary", { name: "Chats" });
  const named = page.getByRole("link", { exact: true, name: "Tugas" });
  const chat = rail.getByRole("link", { exact: true, name: "Tugas" });
  await expect(chat).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  const menu = () =>
    rail
      .getByRole("listitem")
      .filter({ has: named })
      .getByRole("button", { name: "More actions" });

  // Archived, the chat leaves the list for its own filter and takes no message.
  await chat.click();
  await expect(
    page.getByRole("textbox", { name: "Write a message" })
  ).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await menu().click();
  await page.getByRole("menuitem", { name: "Archive chat" }).click();
  await expect(chat).toBeHidden();
  await expect(
    page.getByText("This chat is archived, so it takes no new messages.")
  ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(
    page.getByRole("textbox", { name: "Write a message" })
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Archived" }).click();
  await expect(chat).toBeVisible();

  // Restored, it is back in the list, and the filter that showed it leaves.
  await menu().click();
  await page.getByRole("menuitem", { name: "Restore chat" }).click();
  await expect(page.getByRole("tab", { name: "Archived" })).toHaveCount(0);
  await expect(chat).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Write a message" })
  ).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

  await menu().click();
  await page.getByRole("menuitem", { name: "Delete chat" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete chat" })
    .click();
  await expect(chat).toBeHidden();
  await page.waitForURL(FORUM_PATH);
  await page.reload();
  await expect(rail.getByRole("link", { name: "General" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(chat).toHaveCount(0);
  await context.close();
});
