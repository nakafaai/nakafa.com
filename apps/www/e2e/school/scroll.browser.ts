import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Option } from "effect";
import {
  createSchool,
  hostAddress,
  seedForum,
  signInClassTeacher,
} from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The top of an element on the page, in CSS pixels. */
const topOf = async (page: Page, text: string) =>
  Option.getOrThrow(
    Option.fromNullOr(
      await page.getByText(text, { exact: true }).first().boundingBox()
    )
  ).y;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`a channel opens at the first unread message, follows the newest edge only from the bottom, keeps its place while older history loads, and jumps to a message, at ${viewport.width} px`, async ({
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
    // Fifty messages from a classmate, of which the teacher has read the first thirty.
    const forum = await Effect.runPromise(seedForum(school.slug, 50, 30));
    const page = await context.newPage();

    // The channel list marks the channel with unread messages by one dot.
    await page.goto(address("/classes/fisika-x-1/forum"));
    await expect(page.locator("[data-slot=unread-dot]")).toHaveCount(1, {
      timeout: readinessTimeoutMilliseconds,
    });

    // The channel opens at the first unread message, under the divider, and not at its end.
    const channel = `/classes/fisika-x-1/forum?channel=${forum.channelId}`;
    await page.goto(address(channel));
    const firstUnread = page.getByText("Pesan 31", { exact: true });
    await expect(firstUnread).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(page.getByText("New messages")).toBeVisible();
    await expect(
      page.getByText("Pesan 50", { exact: true })
    ).not.toBeInViewport();

    // A message that arrives while the reader is above the newest edge keeps the reader's place
    // and offers the way to the newest message.
    const before = await topOf(page, "Pesan 31");
    const arrived = await Effect.runPromise(seedForum(school.slug, 1, 0));
    expect(arrived.messages).toHaveLength(1);
    const newest = page.getByRole("button", {
      name: "Go to the newest message",
    });
    await expect(newest).toBeVisible();
    expect(Math.abs((await topOf(page, "Pesan 31")) - before)).toBeLessThan(2);

    // Older history loads upward without moving the message the reader looks at. The reader
    // scrolls with the wheel, as a person does, since a scroll by the page itself is not theirs.
    // The page records where the oldest loaded message stood at the last scroll before the older
    // page arrived, and where it stands once that page is in place.
    const log = page.getByRole("region", { name: "Messages" });
    await log.evaluate((element) => {
      const content = element.querySelector('[role="log"]');
      const topOfOldest = () =>
        Array.from(element.querySelectorAll("p, span, div"))
          .find(
            (node) =>
              node.childElementCount === 0 && node.textContent === "Pesan 21"
          )
          ?.getBoundingClientRect().top ?? null;
      const prepend: { after: number | null; before: number | null } = {
        after: null,
        before: null,
      };
      Reflect.set(window, "__prepend", prepend);
      element.addEventListener("scroll", () => {
        if (prepend.after === null) {
          prepend.before = topOfOldest();
        }
      });
      if (content !== null) {
        new MutationObserver(() => {
          const arrived = Array.from(
            element.querySelectorAll("p, span, div")
          ).some(
            (node) =>
              node.childElementCount === 0 && node.textContent === "Pesan 20"
          );
          if (arrived && prepend.after === null) {
            prepend.after = topOfOldest();
          }
        }).observe(content, { childList: true });
      }
    });
    await log.hover();
    await expect(async () => {
      await page.mouse.wheel(0, -1500);
      await expect(page.getByText("Pesan 20", { exact: true })).toBeAttached({
        timeout: 1000,
      });
    }).toPass({ timeout: readinessTimeoutMilliseconds });
    const shift = await page.evaluate(() => {
      const prepend = Reflect.get(window, "__prepend");
      return Math.abs((prepend.after ?? 0) - (prepend.before ?? Number.NaN));
    });
    expect(shift).toBeLessThan(2);

    // The newest message is one press away, and the reader at the bottom follows new messages.
    await newest.click();
    await expect(page.getByText("Pesan 50", { exact: true })).toBeInViewport();
    await Effect.runPromise(seedForum(school.slug, 1, 0));
    await expect(
      page.getByText("Pesan 1", { exact: true }).last()
    ).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });

    // The read mark follows the reader to the newest message once the view is still, so the
    // channel list, open in a second tab, loses its unread dot while the reader stays.
    const list = await context.newPage();
    await list.goto(address("/classes/fisika-x-1/forum"));
    await expect(list.getByRole("link", { name: "General" })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(list.locator("[data-slot=unread-dot]")).toHaveCount(0, {
      timeout: readinessTimeoutMilliseconds,
    });
    await list.close();

    // A message that the address names comes into view, older pages loading until it is there.
    const third = Option.getOrThrow(Arr.get(forum.messages, 2));
    await page.goto(address(`${channel}&message=${third}`));
    await expect(page.getByText("Pesan 3", { exact: true })).toBeInViewport({
      timeout: readinessTimeoutMilliseconds,
    });

    // Opened again after reading to the newest message, the channel opens at its end.
    await page.goto(address(channel));
    await expect(
      page.getByText("Pesan 1", { exact: true }).last()
    ).toBeInViewport({ timeout: readinessTimeoutMilliseconds });
    await expect(page.getByText("New messages")).toHaveCount(0);
    await context.close();
  });
}
