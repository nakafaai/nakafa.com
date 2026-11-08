import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Number as Num } from "effect";
import {
  readRecordedLayoutShifts,
  recordLayoutShifts,
} from "@/e2e/support/layout";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The page global that holds every layout shift since the page loaded. */
const SHIFTS_KEY = "__nakafaThreadShifts";

/** The page global that counts the chat's messages removed from the page, which a flicker removes and adds back. */
const REMOVED_KEY = "__nakafaThreadRemoved";

/** A discussion's own address. */
const threadPath = (number: number) =>
  new RegExp(`/classes/fisika-x-1/forum/${number}$`, "u");

/** The thread row of a message whose thread holds one reply. */
const ONE_REPLY = /^1 reply/u;

/** The address of the chat the threads belong to. */
const CHANNEL_PATH = /\/classes\/fisika-x-1\/forum\?channel=/u;

/** The screens a class reads its chat on: the narrowest phone, a phone, a tablet and a laptop. */
const SCREENS = [
  { height: 700, width: 320 },
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1440 },
];

/** From this width the thread stands beside the chat; below it, it is a sheet over the chat. */
const BESIDE_FROM = 1280;

/**
 * Counts, from the moment it is called, every message of the chat that leaves the page, apart from the thread's own
 * pane and sheet. A flicker takes the chat's messages away and draws them again, so the count stays zero while
 * nothing flickers.
 */
function recordRemovedMessages(key: string) {
  Reflect.set(window, key, 0);
  new MutationObserver((records) => {
    for (const record of records) {
      const parent = record.target instanceof Element ? record.target : null;
      if (parent?.closest("[data-pane-side], [data-slot=drawer-content]")) {
        continue;
      }
      for (const node of Array.from(record.removedNodes)) {
        if (
          node instanceof Element &&
          (node.matches("[data-slot=message]") ||
            node.querySelector("[data-slot=message]") !== null)
        ) {
          Reflect.set(window, key, Number(Reflect.get(window, key)) + 1);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/** How many of the chat's messages left the page since the count started. */
const removedMessages = (page: Page) =>
  page.evaluate((key) => Number(Reflect.get(window, key)), REMOVED_KEY);

/** The layout shift that no press or key caused, since the page loaded. */
const unansweredShift = async (page: Page) =>
  Num.sumAll(
    Arr.map(
      Arr.filter(
        await Effect.runPromise(readRecordedLayoutShifts(page, SHIFTS_KEY)),
        (shift) => !shift.hadRecentInput
      ),
      (shift) => shift.value
    )
  );

/** The row of the chat's message that reads `text`. */
const messageRow = (page: Page, text: string) =>
  page
    .getByRole("region", { name: "Messages" })
    .first()
    .locator("[data-slot=message]")
    .filter({ hasText: text });

for (const viewport of SCREENS) {
  test(`a thread opens from its message, takes a reply, changes, closes and comes back with no flicker and no layout shift, at ${viewport.width} px`, async ({
    browser,
    baseURL,
  }, info) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const forum = await Effect.runPromise(seedForum(school.slug, 6, 6));
    const page = await context.newPage();
    let errors: readonly string[] = [];
    page.on("pageerror", (error) => {
      errors = Arr.append(errors, error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors = Arr.append(errors, message.text());
      }
    });
    await page.addInitScript(recordLayoutShifts, {
      key: SHIFTS_KEY,
      overlay: "[data-sonner-toaster]",
    });
    const shot = (state: string) =>
      page.screenshot({
        path: info.outputPath(`thread-${state}-${viewport.width}.png`),
      });

    await page.goto(
      address(`/classes/fisika-x-1/forum?channel=${forum.channelId}`)
    );
    await expect(messageRow(page, "Pesan 6")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    // Every message shows its author's face and name, once for a run of the same author.
    await expect(
      page.locator("[data-slot=message] [data-slot=avatar]").first()
    ).toBeVisible();
    await page.evaluate(recordRemovedMessages, REMOVED_KEY);
    const settled = await unansweredShift(page);
    await shot("chat");

    // Reply in thread opens the pane at once, drawn from the message, and the chat stays as it was.
    const fifth = messageRow(page, "Pesan 5");
    await fifth.hover();
    await fifth.getByRole("button", { name: "Reply in thread" }).click();
    await page.waitForURL(threadPath(1));
    const pane = page.locator("[data-slot=discussion]");
    await expect(pane.getByText("Pesan 5")).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, level: 2, name: "Thread" })
    ).toBeVisible();
    if (viewport.width >= BESIDE_FROM) {
      // The message whose thread stands open keeps its selected look.
      await expect(fifth).toHaveAttribute("data-selected", "");
    }
    expect(await removedMessages(page)).toBe(0);
    await shot("open");

    // A reply shows at once, and the chat counts it under the message with the replier's face.
    const field = pane.getByRole("textbox", { name: "Write a reply" });
    await field.fill("Balasan pertama di thread.");
    await field.press("Enter");
    await expect(pane.getByText("Balasan pertama di thread.")).toBeVisible();
    await expect(field).toHaveValue("");
    expect(await removedMessages(page)).toBe(0);
    await shot("replied");

    // Closing leads back to the chat, which kept its place, and the thread's row counts the reply.
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    await page.waitForURL(CHANNEL_PATH);
    await expect(pane).toHaveCount(0);
    const summary = fifth.getByRole("link", { name: ONE_REPLY });
    await expect(summary).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    expect(await removedMessages(page)).toBe(0);
    await shot("closed");

    // Another message starts its own thread; from the laptop width it changes in the pane beside the chat.
    const third = messageRow(page, "Pesan 3");
    await third.hover();
    await third.getByRole("button", { name: "Reply in thread" }).click();
    await page.waitForURL(threadPath(2));
    await expect(pane.getByText("Pesan 3")).toBeVisible();
    if (viewport.width >= BESIDE_FROM) {
      await fifth.hover();
      await summary.click();
      await page.waitForURL(threadPath(1));
      await expect(pane.getByText("Balasan pertama di thread.")).toBeVisible();
      await page.goBack();
      await page.waitForURL(threadPath(2));
      await expect(pane.getByText("Pesan 3")).toBeVisible();
    }
    expect(await removedMessages(page)).toBe(0);
    await shot("changed");

    // Going back closes the thread, and going forward opens it again, the chat untouched both ways.
    await page.goBack();
    await expect(pane).toHaveCount(0);
    await page.goForward();
    await expect(pane.getByText("Pesan 3")).toBeVisible();
    expect(await removedMessages(page)).toBe(0);

    // The thread's row opens it again, with its reply.
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    await page.waitForURL(CHANNEL_PATH);
    await summary.click();
    await page.waitForURL(threadPath(1));
    await expect(pane.getByText("Balasan pertama di thread.")).toBeVisible();
    expect(await removedMessages(page)).toBe(0);
    await shot("summary");

    // Nothing moved that no press or key moved, and the page logged no error.
    expect(await unansweredShift(page)).toBeCloseTo(settled, 3);
    expect(errors).toEqual([]);
    await context.close();
  });
}
