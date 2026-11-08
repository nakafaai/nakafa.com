import { expect, test } from "@playwright/test";
import { Effect, Option } from "effect";
import { saved, trackChanges } from "@/e2e/support/changes";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of the first discussion of the seeded class. */
const DISCUSSION_PATH = /\/classes\/fisika-x-1\/forum\/1$/u;

const TITLE = "Kenapa gaya gesek berlawanan arah gerak?";

/** The thread row of a discussion with no reply yet, and with its first reply. */
const NO_REPLY = /^No reply yet/u;
const ONE_REPLY = /^1 reply/u;

/** The close button of the discussion's pane, which leads back to its channel; a phone's sheet closes by a swipe or Escape. */
const CLOSE = "Close";

/** The address of the channel the discussion belongs to. */
const CHANNEL_PATH = /\/classes\/fisika-x-1\/forum\?channel=/u;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a teacher opens a numbered discussion in a channel, opens it from the channel, and replies in it, at ${viewport.width} px`, async ({
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
    await page.goto(address("/classes/fisika-x-1/forum"));
    const general = page.getByRole("link", { name: "General", exact: true });
    await waitUntilTakenOver(general);
    await general.click();

    // New discussion asks for a title and a first message, and the discussion shows in the
    // channel at once, numbered when the server answers.
    const start = page.getByRole("button", { name: "New discussion" });
    await waitUntilTakenOver(start);
    await start.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Title" }).fill(TITLE);
    await dialog
      .getByRole("textbox", { name: "First message" })
      .fill("Tuliskan contohnya di sini.");
    await dialog.getByRole("button", { name: "Start" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`#1 ${TITLE}`)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // The discussion opens from the thread row under its message, at its own address, with its title as its
    // heading. The path keeps ending at the chat from tablet width, since the pane's heading already names the
    // discussion; on a phone it is a modal sheet, which takes the page behind it, the header's path included, out of
    // reach.
    await page.getByRole("link", { name: NO_REPLY }).click();
    await page.waitForURL(DISCUSSION_PATH);
    await expect(
      page.getByRole("heading", { name: `#1 ${TITLE}`, level: 2 })
    ).toBeVisible();
    if (viewport.width >= 768) {
      const path = page.getByRole("navigation", { name: "breadcrumb" });
      await expect(path).toContainText("General");
      await expect(path).not.toContainText("#1");
    }
    const discussion = page.locator("[data-slot=discussion]");
    await expect(
      discussion.getByText("Tuliskan contohnya di sini.")
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    // A reply shows at once in the discussion, and the server keeps it once it answered: a reload
    // drops a change still on its way.
    const field = discussion.getByRole("textbox", { name: "Write a reply" });
    await field.fill("Karena gaya gesek melawan arah gerak.");
    const repliedBefore = changes.sent;
    await field.press("Enter");
    await expect(
      discussion.getByText("Karena gaya gesek melawan arah gerak.")
    ).toBeVisible();
    await expect(field).toHaveValue("");
    await saved(changes, repliedBefore);
    await page.reload();
    await expect(
      page
        .locator("[data-slot=discussion]")
        .getByText("Karena gaya gesek melawan arah gerak.")
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    // The channel stays beside the discussion from tablet width and under its sheet on a phone,
    // and it counts the reply; closing the discussion leaves the channel where it was.
    if (viewport.width >= 768) {
      await expect(page.getByRole("link", { name: ONE_REPLY })).toBeVisible();
      // The discussion stands in the pane at the screen's right, and the pane's own edge widens it
      // as it is dragged toward the channel. The forum's rail keeps its own handle, which moves no pane.
      const panel = page.locator("[data-slot=discussion]");
      const narrow = Option.getOrThrow(
        Option.fromNullOr(await panel.boundingBox())
      );
      const handle = Option.getOrThrow(
        Option.fromNullOr(
          await page
            .locator("[data-pane-side]")
            .getByRole("separator", { name: "Change width" })
            .boundingBox()
        )
      );
      const middle = handle.y + handle.height / 2;
      await page.mouse.move(handle.x + handle.width / 2, middle);
      await page.mouse.down();
      await page.mouse.move(handle.x - 200, middle, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(narrow.width + 150);
    }
    // Beside the chat the pane closes from its header; on a phone the sheet has no close button and closes by Escape,
    // a swipe down or a tap outside.
    if (viewport.width >= 1280) {
      await page.getByRole("button", { name: CLOSE, exact: true }).click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page.waitForURL(CHANNEL_PATH);
    await expect(page.locator("[data-slot=discussion]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: ONE_REPLY })).toBeVisible();
    await context.close();
  });
}
