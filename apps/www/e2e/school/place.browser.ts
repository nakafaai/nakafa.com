import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A phone and a laptop: a thread is a sheet over the chat on the first, a pane beside it on the second. */
const SCREENS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
];

/** The summary row of a thread of thirty replies. */
const THIRTY_REPLIES = /^30 replies/u;

/** Longer than the place waits for the view to stay still before it keeps it. */
const SETTLE_MILLISECONDS = 900;

/** The scroller of a list of messages, inside `scope`. */
const scrollerIn = (scope: Page | Locator) =>
  scope.getByRole("region", { exact: true, name: "Messages" }).first();

/**
 * Where the reader stands in a list of messages: how far from its newest edge, which message is the first one whose
 * bottom is below the view's top, and how far below the view's top that message starts.
 */
const standing = (scroller: Locator) =>
  scroller.evaluate((view) => {
    const top = view.getBoundingClientRect().top;
    const first = Array.from(
      view.querySelectorAll(
        "[data-slot=message-scroller-item][data-message-id]"
      )
    ).find((item) => item.getBoundingClientRect().bottom > top + 1);
    return {
      fromEnd: Math.round(
        view.scrollHeight - view.scrollTop - view.clientHeight
      ),
      offset: first ? Math.round(first.getBoundingClientRect().top - top) : 0,
      room: view.scrollHeight - view.clientHeight,
      top: first?.querySelector("[data-slot=message]")?.textContent ?? "",
    };
  });

/** From this width a thread stands beside the chat with its Close button; below it, it is a sheet Escape closes. */
const BESIDE_FROM = 1280;

/** Closes the open thread: its Close button beside the chat, Escape on a phone's sheet, as `thread.browser.ts` does. */
const closeThread = async (page: Page, width: number) => {
  if (width >= BESIDE_FROM) {
    await page.getByRole("button", { exact: true, name: "Close" }).click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(page.locator("[data-slot=discussion]")).toHaveCount(0);
};

/** Scrolls a list of messages up by `pixels`, as a reader's finger or wheel does, in every engine. */
const scrollUp = (scroller: Locator, pixels: number) =>
  scroller.evaluate((view, by) => {
    view.scrollBy({ top: -by });
  }, pixels);

for (const viewport of SCREENS) {
  test(`a chat opens at its first unread message past a page of them, then where the reader left it, then at its end, at ${viewport.width} px`, async ({
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
    // A hundred and twenty messages, of which the teacher read forty: eighty unread, more than one page holds.
    const forum = await Effect.runPromise(seedForum(school.slug, 120, 40));
    const page = await context.newPage();
    const channel = address(
      `/classes/fisika-x-1/forum?channel=${forum.channelId}`
    );
    const scroller = scrollerIn(page);

    // The first unread message opens under its divider, whatever page it is on.
    await page.goto(channel);
    await expect(page.getByText("Pesan 41", { exact: true })).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.getByText("New messages")).toBeInViewport();
    await expect(
      page.getByText("Pesan 120", { exact: true })
    ).not.toBeInViewport();

    // The reader goes to the newest message, which reads the chat, then scrolls back into its history.
    await page
      .getByRole("button", { name: "Go to the newest message" })
      .click();
    await expect(page.getByText("Pesan 120", { exact: true })).toBeInViewport();
    await page.waitForTimeout(SETTLE_MILLISECONDS);
    await scrollUp(scroller, 1800);
    await page.waitForTimeout(SETTLE_MILLISECONDS);
    const left = await standing(scroller);
    expect(left.fromEnd).toBeGreaterThan(400);

    // Opened again with nothing unread, the chat stands where the reader left it, the same message at the same height.
    await page.goto(channel);
    await expect(page.getByText(left.top, { exact: true })).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });
    const back = await standing(scroller);
    expect(back.top).toBe(left.top);
    expect(Math.abs(back.offset - left.offset)).toBeLessThan(4);
    await expect(page.getByText("New messages")).toHaveCount(0);

    // Left at its newest message, the chat opens at its end.
    await page
      .getByRole("button", { name: "Go to the newest message" })
      .click();
    await expect(page.getByText("Pesan 120", { exact: true })).toBeInViewport();
    await page.waitForTimeout(SETTLE_MILLISECONDS);
    await page.goto(channel);
    await expect(page.getByText("Pesan 120", { exact: true })).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });
    expect((await standing(scroller)).fromEnd).toBeLessThan(9);
    await context.close();
  });

  test(`moving from a chat to another and back keeps the first chat's messages on the page, drawn at once, at ${viewport.width} px`, async ({
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
    await Effect.runPromise(seedForum(school.slug, 12, 12));
    const page = await context.newPage();
    await page.goto(address("/classes/fisika-x-1/forum"));
    const rail = page.getByRole("complementary", { name: "Chats" });
    const add = rail.getByRole("button", { name: "Add chat" });
    await expect(add).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await add.click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Chat name" })
      .fill("Tugas");
    await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
    const tasks = rail.getByRole("link", { exact: true, name: "Tugas" });
    const general = rail.getByRole("link", { exact: true, name: "General" });
    await expect(tasks).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    await general.click();
    await expect(page.getByText("Pesan 12", { exact: true })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.evaluate(() => {
      const removed = { count: 0 };
      Reflect.set(window, "__generalRemoved", removed);
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.removedNodes)) {
            if (
              node instanceof Element &&
              (node.matches("[data-slot=message]") ||
                node.querySelector("[data-slot=message]") !== null)
            ) {
              removed.count += 1;
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    // To the other chat and back, twice: through the list on a phone, as WhatsApp moves, and beside it on a laptop.
    // The general chat's messages never leave the page.
    const phone = viewport.width < 1024;
    for (let round = 0; round < 2; round += 1) {
      if (phone) {
        await page.goBack();
      }
      await tasks.click();
      await expect(
        page.getByRole("textbox", { name: "Write a message" })
      ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
      if (phone) {
        await page.goBack();
      }
      await general.click();
      await expect(page.getByText("Pesan 12", { exact: true })).toBeVisible();
    }
    expect(
      await page.evaluate(() =>
        Number(Reflect.get(window, "__generalRemoved").count)
      )
    ).toBe(0);
    await context.close();
  });

  test(`a long thread scrolls inside its pane or sheet, opens at its newest reply, and opens again where the reader left it, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(240_000);
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const forum = await Effect.runPromise(seedForum(school.slug, 3, 3));
    const page = await context.newPage();
    await page.goto(
      address(`/classes/fisika-x-1/forum?channel=${forum.channelId}`)
    );
    const second = scrollerIn(page)
      .locator("[data-slot=message]")
      .filter({ hasText: "Pesan 2" });
    await expect(second).toBeVisible({ timeout: readinessTimeoutMilliseconds });

    // Thirty replies, more than any screen holds.
    await second.hover();
    await second.getByRole("button", { name: "Reply in thread" }).click();
    const pane = page.locator("[data-slot=discussion]");
    const field = pane.getByRole("textbox", { name: "Write a reply" });
    await expect(field).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    for (let reply = 1; reply <= 30; reply += 1) {
      await field.fill(`Balasan ${reply}`);
      await field.press("Enter");
    }
    await expect(pane.getByText("Balasan 30", { exact: true })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await closeThread(page, viewport.width);

    // The thread opens at its newest reply with its composer on the screen, and its list has room to scroll.
    const summary = page.getByRole("link", { name: THIRTY_REPLIES });
    await summary.click();
    const thread = scrollerIn(pane);
    await expect(pane.getByText("Balasan 30", { exact: true })).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(field).toBeInViewport();
    const opened = await standing(thread);
    expect(opened.room).toBeGreaterThan(200);
    expect(opened.fromEnd).toBeLessThan(9);

    // The reader scrolls up in the thread, and the list moves under them.
    await scrollUp(thread, 500);
    await page.waitForTimeout(SETTLE_MILLISECONDS);
    const left = await standing(thread);
    expect(left.fromEnd).toBeGreaterThan(300);

    // Closed and opened again, the thread stands where the reader left it.
    await closeThread(page, viewport.width);
    await summary.click();
    await expect(pane.getByText(left.top, { exact: true })).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });
    const back = await standing(thread);
    expect(back.top).toBe(left.top);
    expect(Math.abs(back.offset - left.offset)).toBeLessThan(4);
    await context.close();
  });

  test(`the thread list switches between its open and archived threads with both views and their rows on the page in every frame, at ${viewport.width} px`, async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(180_000);
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInClassTeacher(context, school.slug, address("/"))
    );
    const forum = await Effect.runPromise(seedForum(school.slug, 3, 3));
    const page = await context.newPage();
    await page.goto(
      address(`/classes/fisika-x-1/forum?channel=${forum.channelId}`)
    );

    // Two threads, one of them archived.
    for (const text of ["Pesan 1", "Pesan 2"]) {
      const message = scrollerIn(page)
        .locator("[data-slot=message]")
        .filter({ hasText: text });
      await expect(message).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await message.hover();
      await message.getByRole("button", { name: "Reply in thread" }).click();
      const field = page
        .locator("[data-slot=discussion]")
        .getByRole("textbox", { name: "Write a reply" });
      await field.fill(`Balasan untuk ${text}`);
      await field.press("Enter");
      await expect(page.getByText(`Balasan untuk ${text}`)).toBeVisible();
      await closeThread(page, viewport.width);
    }
    await page.goto(address("/classes/fisika-x-1/forum"));
    const rail = page.getByRole("complementary", { name: "Chats" });
    await rail
      .getByRole("button", { exact: true, name: "Threads" })
      .click({ timeout: readinessTimeoutMilliseconds });
    const list = rail.getByRole("list", { name: "Threads" });
    await expect(list.getByRole("listitem")).toHaveCount(2, {
      timeout: readinessTimeoutMilliseconds,
    });
    await list
      .getByRole("listitem")
      .first()
      .getByRole("button", { name: "More actions" })
      .click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);

    // Every frame from here holds the views and at least one row, while the reader switches back and forth.
    await page.evaluate(() => {
      const frames = { empty: 0, total: 0, unviewed: 0 };
      Reflect.set(window, "__threadFrames", frames);
      const tick = () => {
        const rail = document.querySelector('[aria-label="Chats"]');
        frames.total += 1;
        if (!rail?.querySelector('[aria-label="Show discussions"]')) {
          frames.unviewed += 1;
        }
        if (!rail?.querySelector('[aria-label="Threads"] li')) {
          frames.empty += 1;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const archived = rail.getByRole("button", {
      exact: true,
      name: "Archived",
    });
    const active = rail.getByRole("button", { exact: true, name: "Active" });
    for (const view of [archived, active, archived, active]) {
      await view.click();
      await page.waitForTimeout(400);
    }
    await expect(list.getByRole("listitem")).toHaveCount(1);
    const frames = await page.evaluate(() => {
      const counted = Reflect.get(window, "__threadFrames");
      return {
        empty: Number(counted.empty),
        total: Number(counted.total),
        unviewed: Number(counted.unviewed),
      };
    });
    expect(frames.total).toBeGreaterThan(20);
    expect(frames.unviewed).toBe(0);
    expect(frames.empty).toBe(0);
    await context.close();
  });
}

test("the phone's sidebar opens on what it already drew: no link or picture is added as it opens, the second time too", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const address = (path: string) =>
    hostAddress(baseURL, `${school.slug}.localhost`, path);
  const context = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  await Effect.runPromise(
    signInClassTeacher(context, school.slug, address("/"))
  );
  const page = await context.newPage();
  await page.goto(address("/classes/fisika-x-1/forum"));
  const sheet = page.locator('[data-mobile="true"]');
  const trigger = page.locator("[data-slot=sidebar-trigger]").first();
  await expect(trigger).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  // The sidebar's links are in the page, unseen, before the first press.
  await expect(sheet.locator("a[href]").first()).toBeAttached({
    timeout: readinessTimeoutMilliseconds,
  });
  // The phone draws the sidebar once: no copy of its links waits in the page outside the sheet.
  await expect(page.locator("[data-slot=sidebar-inner] a[href]")).toHaveCount(
    0
  );

  for (let open = 0; open < 2; open += 1) {
    await sheet.evaluate((element) => {
      const added = { count: 0 };
      Reflect.set(window, "__sidebarAdded", added);
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (
              node instanceof Element &&
              (node.matches("a, img") || node.querySelector("a, img") !== null)
            ) {
              added.count += 1;
            }
          }
        }
      }).observe(element, { childList: true, subtree: true });
    });
    await trigger.click();
    await expect(sheet.locator("a[href]").first()).toBeVisible();
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(() =>
        Number(Reflect.get(window, "__sidebarAdded").count)
      )
    ).toBe(0);
    await page.keyboard.press("Escape");
    await expect(sheet.locator("a[href]").first()).toBeHidden();
  }
  await context.close();
});
