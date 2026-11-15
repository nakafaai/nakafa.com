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
 * pane and sheet, closed whole or changed inside. A flicker takes the chat's messages away and draws them again, so
 * the count stays zero while nothing flickers.
 */
function recordRemovedMessages(key: string) {
  const thread = "[data-pane-side], [data-slot=drawer-content]";
  /** Whether a removed node takes a message of the chat with it, not only the thread's own. */
  const takesChat = (node: Node) => {
    if (!(node instanceof Element)) {
      return false;
    }
    const messages = node.matches("[data-slot=message]")
      ? [node]
      : Array.from(node.querySelectorAll("[data-slot=message]"));
    return messages.some((message) => message.closest(thread) === null);
  };
  Reflect.set(window, key, 0);
  new MutationObserver((records) => {
    for (const record of records) {
      const parent = record.target instanceof Element ? record.target : null;
      if (parent?.closest(thread)) {
        continue;
      }
      for (const node of Array.from(record.removedNodes)) {
        if (takesChat(node)) {
          Reflect.set(window, key, Number(Reflect.get(window, key)) + 1);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

/** How many of the chat's messages left the page since the count started. */
const removedMessages = (page: Page) =>
  page.evaluate((key) => Number(Reflect.get(window, key)), REMOVED_KEY);

/** The page global that counts every thread body that came onto the page with no message in it. */
const BLANK_KEY = "__nakafaThreadBlank";

/** The page global that counts every message, the chat's or a thread's, that left the page since it loaded. */
const RELOAD_KEY = "__nakafaThreadReloadRemoved";

/**
 * Counts, from the page's start, every thread body that comes onto the page without a message in it: a pane or a sheet
 * that opens empty and fills a moment later flickers, so the count stays zero while every thread draws whole.
 */
function recordBlankThreads(key: string) {
  /** Whether an added node brings a thread body with no message in it. */
  const isBlank = (node: Node) => {
    if (!(node instanceof Element)) {
      return false;
    }
    const bodies = node.matches("[data-slot=discussion]")
      ? [node]
      : Array.from(node.querySelectorAll("[data-slot=discussion]"));
    return bodies.some(
      (body) => body.querySelector("[data-slot=message]") === null
    );
  };
  Reflect.set(window, key, 0);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (isBlank(node)) {
          Reflect.set(window, key, Number(Reflect.get(window, key)) + 1);
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

/** Counts, from the page's start, every message that leaves the page, a thread's included. */
function recordEveryRemovedMessage(key: string) {
  /** Whether a removed node takes a message with it. */
  const takesMessage = (node: Node) =>
    node instanceof Element &&
    (node.matches("[data-slot=message]") ||
      node.querySelector("[data-slot=message]") !== null);
  Reflect.set(window, key, 0);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.removedNodes)) {
        if (takesMessage(node)) {
          Reflect.set(window, key, Number(Reflect.get(window, key)) + 1);
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

/** What the page global `key` counted. */
const counted = (page: Page, key: string) =>
  page.evaluate((name) => Number(Reflect.get(window, name)), key);

/**
 * Closes the open thread: beside the chat from its header's close button; on a phone by Escape, since the sheet has no
 * close button and closes as an iPhone's sheet does.
 */
const closeThread = async (page: Page, width: number) => {
  if (width >= BESIDE_FROM) {
    await page.getByRole("button", { exact: true, name: "Close" }).click();
    return;
  }
  await expect(
    page.getByRole("dialog").getByRole("button", { exact: true, name: "Close" })
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
};

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
    await page.addInitScript(recordBlankThreads, BLANK_KEY);
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

    // A message's toolbar, its menu, the hide dialog and the emoji chooser, each drawn as it opens.
    const sixth = messageRow(page, "Pesan 6");
    await sixth.hover();
    await shot("toolbar");
    await sixth.getByRole("button", { name: "More actions" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Copy text" })
    ).toBeVisible();
    await shot("menu");
    await page.getByRole("menuitem", { name: "Hide" }).click();
    const hide = page.getByRole("dialog", { name: "Hide this message" });
    await expect(hide.getByText("Pesan 6")).toBeVisible();
    await shot("hide");
    await page.keyboard.press("Escape");
    await expect(hide).toBeHidden();
    await sixth.hover();
    await sixth.getByRole("button", { name: "React" }).click();
    const chooser = page.locator("[data-slot=emoji-panel]");
    await expect(
      chooser.getByRole("searchbox", { name: "Search emoji" })
    ).toBeVisible();
    await shot("emoji");
    await page.keyboard.press("Escape");
    await expect(chooser).toBeHidden();
    expect(await removedMessages(page)).toBe(0);

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
      // The message whose thread stands open keeps its selected look, and its chat stays the open one in the list.
      await expect(fifth).toHaveAttribute("data-selected", "");
      await expect(page.locator('li[data-open="true"]')).toHaveCount(1);
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
    await closeThread(page, viewport.width);
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
    await closeThread(page, viewport.width);
    await page.waitForURL(CHANNEL_PATH);
    await summary.click();
    await page.waitForURL(threadPath(1));
    await expect(pane.getByText("Balasan pertama di thread.")).toBeVisible();
    expect(await removedMessages(page)).toBe(0);
    await shot("summary");

    // Nothing moved that no press or key moved, and every thread drew whole.
    expect(await unansweredShift(page)).toBeCloseTo(settled, 3);
    expect(await counted(page, BLANK_KEY)).toBe(0);

    // A reload with the thread open draws the chat and the thread whole, each once: no message leaves the page, the
    // thread's own included, no thread body shows empty, and nothing moves.
    await page.addInitScript(recordEveryRemovedMessage, RELOAD_KEY);
    await page.reload();
    await expect(pane.getByText("Balasan pertama di thread.")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    // The chat draws behind the thread too. A phone's sheet takes the page behind it out of the accessibility tree, so
    // the chat's message is looked for in the page, not in the region its role names.
    await expect(
      page.locator("[data-slot=message]").filter({ hasText: "Pesan 6" })
    ).toBeAttached();
    await page.waitForLoadState("networkidle");
    expect(await counted(page, RELOAD_KEY)).toBe(0);
    expect(await counted(page, BLANK_KEY)).toBe(0);
    expect(await unansweredShift(page)).toBeCloseTo(0, 3);
    await shot("reloaded");

    // The page logged no error.
    expect(errors).toEqual([]);
    await context.close();
  });
}
