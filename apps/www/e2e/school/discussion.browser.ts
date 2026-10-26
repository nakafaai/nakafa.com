import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of the first discussion of the seeded class. */
const DISCUSSION_PATH = /\/classes\/fisika-x-1\/forum\/1$/;

const TITLE = "Kenapa gaya gesek berlawanan arah gerak?";

/** The discussion's close button, which leads back to its channel. */
const CLOSE = "Close discussion";

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
    const numbered = page.getByRole("link", { name: `#1 ${TITLE}` });
    await expect(numbered).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });

    // The discussion opens at its own address, with its title in the path and as its heading.
    await page.getByRole("link", { name: "Reply", exact: true }).click();
    await page.waitForURL(DISCUSSION_PATH);
    await expect(
      page.getByRole("heading", { name: `#1 ${TITLE}`, level: 2 })
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" })
    ).toContainText("#1");
    const discussion = page.locator("[data-slot=discussion]");
    await expect(
      discussion.getByText("Tuliskan contohnya di sini.")
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    // A reply shows at once in the discussion, and the server keeps it.
    const field = discussion.getByRole("textbox", { name: "Write a reply" });
    await field.fill("Karena gaya gesek melawan arah gerak.");
    await field.press("Enter");
    await expect(
      discussion.getByText("Karena gaya gesek melawan arah gerak.")
    ).toBeVisible();
    await expect(field).toHaveValue("");
    await page.reload();
    await expect(
      page
        .locator("[data-slot=discussion]")
        .getByText("Karena gaya gesek melawan arah gerak.")
    ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    // The channel stays beside the discussion from tablet width and under its sheet on a phone,
    // and it counts the reply; closing the discussion leaves the channel where it was.
    await expect(page.getByRole("link", { name: "1 reply" })).toBeVisible();
    await page.getByRole("link", { name: CLOSE }).click();
    await page.waitForURL(CHANNEL_PATH);
    await expect(page.locator("[data-slot=discussion]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "1 reply" })).toBeVisible();
    await context.close();
  });
}
