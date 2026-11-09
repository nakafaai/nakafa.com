import { expect, type Page, test } from "@playwright/test";
import { seedXendit } from "@repo/backend/scripts/content/acceptance/xendit";
import { Array as Arr, Effect, Schema } from "effect";
import { runFixture } from "@/e2e/support/acceptance";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * Google's ad script. The tests answer it with an empty script, so no request
 * leaves the machine and AdSense never answers that it has no ad: the frame stays.
 */
const AD_SCRIPT = "https://pagead2.googlesyndication.com/**";

/** The size of each layout shift that the page recorded. */
const Shifts = Schema.Array(Schema.Finite);

/** Records every layout shift that no input caused, from the first paint on. */
function recordShifts() {
  const shifts: number[] = [];
  Object.assign(window, { nakafaShifts: shifts });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!("hadRecentInput" in entry && entry.hadRecentInput)) {
        shifts.push("value" in entry ? Number(entry.value) : 0);
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });
}

/** Answers the ad script with an empty one, and returns how many times the page asked for it. */
async function stubAdScript(page: Page) {
  let requests = 0;
  await page.route(AD_SCRIPT, (route) => {
    requests += 1;
    return route.fulfill({ body: "", contentType: "text/javascript" });
  });
  return () => requests;
}

/**
 * Scrolls until the first ad place stands a screen and a half under the view:
 * near enough to open, still out of sight. The scroll is also the reader's first
 * gesture, which the frame waits for.
 */
async function nearFirstPlace(page: Page) {
  await page.evaluate(() => {
    const place = document.querySelector("[data-ad-slot]");
    const top = place?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, window.scrollY + top - window.innerHeight * 1.5);
  });
}

/** The frame of the first ad place. */
const firstFrame = (page: Page) => page.locator("[data-ad-slot] aside").first();

/** The height the first ad place takes on the page. */
const firstRoom = (page: Page) =>
  page
    .locator("[data-ad-slot]")
    .first()
    .evaluate((place) => place.getBoundingClientRect().height);

/**
 * Moves the pointer until the first frame stands. The page listens for its
 * reader only once it has hydrated and settled (ADR 0039), so a gesture made
 * before that goes unseen, and the frame would wait for the ten seconds a page
 * gives a reader who never moves; the pointer keeps moving until one is seen.
 */
async function readUntilFrame(page: Page) {
  let step = 0;
  await expect(async () => {
    step += 1;
    await page.mouse.move(8 + (step % 2) * 8, 8);
    await expect(firstFrame(page)).toBeAttached({ timeout: 500 });
  }).toPass({ timeout: revealTimeoutMilliseconds });
}

test("a visitor finds a frame between two sections that moves nothing and explains itself", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, () =>
    Effect.gen(function* () {
      const requests = yield* Effect.promise(() => stubAdScript(page));
      yield* seedAnalyticsConsent(page, "denied");
      yield* Effect.promise(async () => {
        await page.addInitScript(recordShifts);
        await page.goto(pinnedRoutes.material.en);

        // The page's HTML holds the places, empty, and at most two of them,
        // each before a section's heading.
        const places = page.locator("[data-ad-slot]");
        await expect(places.first()).toBeAttached();
        expect(await places.count()).toBeLessThanOrEqual(2);
        const following = await places.evaluateAll((all) =>
          all.map((place) => place.nextElementSibling?.tagName)
        );
        expect(Arr.every(following, (tag) => tag === "H2")).toBe(true);
        expect(requests()).toBe(0);
        // The HTML already holds the frame's room, so the frame fills it.
        const room = await firstRoom(page);
        expect(room).toBeGreaterThan(0);

        await nearFirstPlace(page);
        await readUntilFrame(page);
        const frame = firstFrame(page);
        await expect.poll(requests).toBe(1);
        expect(await firstRoom(page)).toBe(room);

        await frame.scrollIntoViewIfNeeded();
        await expect(frame).toHaveAccessibleName("Advertisements");
        await expect(frame.getByText("Pro has no ads.")).toBeVisible();
        await expect(
          frame.getByRole("link", { name: "See Pro" })
        ).toHaveAttribute("href", "/en/pricing");
      });

      // The frame appeared under the screen, so nothing the reader saw moved.
      const shifts = yield* Effect.promise(() =>
        page.evaluate(() => Reflect.get(window, "nakafaShifts"))
      ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Shifts)));
      expect(Arr.reduce(shifts, 0, (sum, shift) => sum + shift)).toBeLessThan(
        0.001
      );

      yield* Effect.promise(async () => {
        const frame = firstFrame(page);
        await frame.getByRole("button", { name: "Why ads?" }).click();
        const note = page.getByRole("dialog", {
          name: "Why does Nakafa show ads?",
        });
        await expect(note.getByText("Nabil, founder of Nakafa")).toBeVisible();
        await note.getByRole("button", { name: "Cancel" }).click();
        await expect(note).toBeHidden();
      });
    })
  );
});

test("a learner sees the frame on the free plan and loses it with Pro, without the ad script after", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const requests = yield* Effect.promise(() => stubAdScript(page));
      yield* Effect.promise(async () => {
        await page.goto(pinnedRoutes.material.en);
        await nearFirstPlace(page);
        await readUntilFrame(page);
      });

      yield* runFixture(seedXendit(learner.userId, "pass"));
      yield* Effect.promise(async () => {
        // The account follows the plan live, so the frame leaves at once.
        await expect(firstFrame(page)).toHaveCount(0);

        const before = requests();
        await page.reload();
        await expect(
          page.getByRole("button").filter({ hasText: "Pro" }).first()
        ).toBeVisible();
        await nearFirstPlace(page);
        // The page has hydrated, so a gesture after it settles is seen; then
        // time for the placement's code to load and the account to answer: a
        // frame that would appear does so within it.
        await page.mouse.move(8, 8);
        await page.waitForTimeout(1500);
        await page.mouse.move(16, 8);
        await page.waitForTimeout(3000);
        await expect(firstFrame(page)).toHaveCount(0);
        // The room a Pro learner never fills closes under the screen.
        await expect.poll(() => firstRoom(page)).toBe(0);
        expect(requests()).toBe(before);
      });
    })
  );
});
