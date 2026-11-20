import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { AD_SCRIPT_PATH } from "@repo/backend/scripts/content/acceptance/ads";
import { seedXendit } from "@repo/backend/scripts/content/acceptance/xendit";
import { Array as Arr, Effect, Schema } from "effect";
import { runFixture } from "@/e2e/support/acceptance";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * The ad script, which a proof's build loads from the acceptance runtime's
 * stand-in (`AD_SCRIPT_PATH`). The tests answer it themselves: with an empty
 * script AdSense never answers, as while the site waits for review or under an
 * ad blocker, and with `FILLING_SCRIPT` every unit gets an ad of a phone's
 * in-article height.
 */
const AD_SCRIPT = `**${AD_SCRIPT_PATH}*`;

/** Puts a 280 px ad in every unit that asks, the way AdSense marks a unit it filled. */
const FILLING_SCRIPT = `
window.adsbygoogle = {
  push() {
    for (const unit of document.querySelectorAll("ins.adsbygoogle[data-ad-asked]:not([data-ad-status])")) {
      unit.style.height = "280px";
      unit.setAttribute("data-ad-status", "filled");
    }
  },
};
`;

/** The widths of a phone, a tablet and a desktop. */
const WIDTHS = [390, 768, 1440];

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

/** The sum of the page's layout shifts so far. */
const shiftSum = (page: Page) =>
  Effect.runPromise(
    Effect.promise(() =>
      page.evaluate(() => Reflect.get(window, "nakafaShifts"))
    ).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Shifts)),
      Effect.map((shifts) => Arr.reduce(shifts, 0, (sum, shift) => sum + shift))
    )
  );

/** Answers the ad script with `body`, and returns how many times the page asked for it. */
async function stubAdScript(page: Page, body: string) {
  let requests = 0;
  await page.route(AD_SCRIPT, (route) => {
    requests += 1;
    return route.fulfill({ body, contentType: "text/javascript" });
  });
  return () => requests;
}

/** Screens under the top of the view where a place is near enough to open, still out of sight. */
const NEAR = 1.5;

/**
 * Screens under the top of the view within which a place opens: the view and the
 * screen under it (`NEAR_SCREEN` in components/ads/slot.tsx).
 */
const REACH = 2;

/**
 * Screens under the top of the view where a place stands out of reach. A jump
 * down a phone's lesson lets the sections it passes take their size, which
 * brings the place up to 0.6 of a screen nearer at once in WebKit, so the place
 * starts well past the reach.
 */
const OUT_OF_REACH = 3.5;

/** Scrolls until the first ad place stands `screens` screens under the top of the view. */
async function scrollToFirstPlace(page: Page, screens: number) {
  await page.evaluate((distance) => {
    const place = document.querySelector("div[data-ad-slot]");
    const top = place?.getBoundingClientRect().top ?? 0;
    window.scrollTo(0, window.scrollY + top - window.innerHeight * distance);
  }, screens);
}

/** Scrolls until the first ad place is near enough to open, still out of sight. */
const nearFirstPlace = (page: Page) => scrollToFirstPlace(page, NEAR);

/**
 * Scrolls the first place just out of reach and lets the scroll settle, counts
 * layout shifts from there on, and brings the place near. A long lesson that
 * hydrates while the reader scrolls can shift by itself before any frame exists,
 * as its sections take their place. A scroll is a reader's gesture once the page
 * has settled (ADR 0039), and WebKit settles at the load and scrolls the page
 * itself to anchor it, so a scroll could open the frame; out of reach it cannot,
 * and from the count on a shift could come from the frame.
 */
async function nearFirstPlaceCountingShifts(page: Page) {
  await scrollToFirstPlace(page, OUT_OF_REACH);
  await page.waitForTimeout(1000);
  expect(await firstPlaceScreens(page)).toBeGreaterThan(REACH);
  await expect(firstFrame(page)).toHaveCount(0);
  await page.evaluate(() => {
    const shifts = Reflect.get(window, "nakafaShifts");
    if (Array.isArray(shifts)) {
      shifts.length = 0;
    }
  });
  await nearFirstPlace(page);
}

/** The first ad place. */
const firstPlace = (page: Page) => page.locator("div[data-ad-slot]").first();

/** The frame of the first ad place, mounted or shown. */
const firstFrame = (page: Page) => firstPlace(page).locator("aside");

/** How many screens under the top of the view the first ad place stands. */
const firstPlaceScreens = (page: Page) =>
  firstPlace(page).evaluate(
    (place) => place.getBoundingClientRect().top / window.innerHeight
  );

/**
 * The first place's height, and the space between the sections around it, with
 * the place and as if the page had none.
 */
const firstGaps = (page: Page) =>
  firstPlace(page).evaluate((place) => {
    const gap = () =>
      (place.nextElementSibling?.getBoundingClientRect().top ?? 0) -
      (place.previousElementSibling?.getBoundingClientRect().bottom ?? 0);
    const withPlace = gap();
    const display = place.style.display;
    place.style.display = "none";
    const withoutPlace = gap();
    place.style.display = display;
    return {
      height: place.getBoundingClientRect().height,
      withoutPlace,
      withPlace,
    };
  });

/**
 * Moves the pointer until the first frame is mounted. The page listens for its
 * reader only once it has hydrated and settled (ADR 0039), so a gesture made
 * before that goes unseen; the pointer keeps moving until one is seen.
 */
async function readUntilFrame(page: Page) {
  let step = 0;
  await expect(async () => {
    step += 1;
    await page.mouse.move(8 + (step % 2) * 8, 8);
    await expect(firstFrame(page)).toBeAttached({ timeout: 500 });
  }).toPass({ timeout: revealTimeoutMilliseconds });
}

/**
 * Opens the lesson at its top. A load of the address the page already shows
 * restores the scroll it left, as WebKit does for every width after the first,
 * which would bring the first place near before the test scrolls: the page
 * goes back to its top before it leaves.
 */
async function openLessonAtTop(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.goto(pinnedRoutes.material.en);
}

/** Expects the first place to take no room: the sections keep the spacing they have without it. */
async function expectNoRoom(page: Page) {
  const gaps = await firstGaps(page);
  expect(gaps.height).toBe(0);
  expect(gaps.withPlace).toBe(gaps.withoutPlace);
}

test("an ad that never comes leaves the page as if it had no frame, at every width", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, () =>
    Effect.gen(function* () {
      const requests = yield* Effect.promise(() => stubAdScript(page, ""));
      yield* Effect.promise(async () => {
        await page.addInitScript(recordShifts);
        for (const width of WIDTHS) {
          await page.setViewportSize({ height: 800, width });
          await openLessonAtTop(page);

          // The page's HTML holds the places, empty, and at most two of them,
          // each before a section's heading.
          const places = page.locator("div[data-ad-slot]");
          await expect(places.first()).toBeAttached();
          expect(await places.count()).toBeLessThanOrEqual(2);
          const following = await places.evaluateAll((all) =>
            all.map((place) => place.nextElementSibling?.tagName)
          );
          expect(Arr.every(following, (tag) => tag === "H2")).toBe(true);
          await expectNoRoom(page);

          // The frame asks for its ad and waits out of sight; AdSense never
          // answers, so the reader never sees it.
          await nearFirstPlaceCountingShifts(page);
          await readUntilFrame(page);
          await expect.poll(requests).toBeGreaterThan(0);
          await firstPlace(page).scrollIntoViewIfNeeded();
          await expect(firstFrame(page)).toBeHidden();
          await expectNoRoom(page);
          expect(await shiftSum(page)).toBeLessThan(0.001);
        }
      });
    })
  );
});

test("a filled ad comes in a frame of its own height that moves nothing the reader sees", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => stubAdScript(page, FILLING_SCRIPT));
      yield* Effect.promise(async () => {
        await page.addInitScript(recordShifts);
        for (const width of WIDTHS) {
          await page.setViewportSize({ height: 800, width });
          await openLessonAtTop(page);
          await nearFirstPlaceCountingShifts(page);
          await readUntilFrame(page);

          const frame = firstFrame(page);
          await frame.scrollIntoViewIfNeeded();
          await expect(frame).toBeVisible();
          await expect(frame).toHaveAccessibleName("Advertisements");
          await expect(frame.getByText("Pro has no ads.")).toBeVisible();
          await expect(
            frame.getByRole("link", { name: "See Pro" })
          ).toHaveAttribute("href", "/en/pricing");
          // The frame takes the ad's height with its header and footer, never
          // a room of its own.
          const { height } = await firstGaps(page);
          expect(height).toBeGreaterThan(280);
          expect(height).toBeLessThan(480);
          // The ad came while the place stood under the screen.
          expect(await shiftSum(page)).toBeLessThan(0.001);
        }

        await firstFrame(page)
          .getByRole("button", { name: "Why ads?" })
          .click();
        const note = page.getByRole("dialog", {
          name: "Why does Nakafa show ads?",
        });
        await expect(note.getByText("Nabil, founder of Nakafa")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(note).toBeHidden();
      });
    })
  );
});

test("a learner sees the frame on the free plan and has no trace of it with Pro, without the ad script after", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const requests = yield* Effect.promise(() =>
        stubAdScript(page, FILLING_SCRIPT)
      );
      yield* Effect.promise(async () => {
        await page.goto(pinnedRoutes.material.en);
        await nearFirstPlace(page);
        await readUntilFrame(page);
        await expect(firstFrame(page)).toBeVisible();
      });

      yield* runFixture(seedXendit(learner.userId, "pass"));
      yield* Effect.promise(async () => {
        // The account follows the plan live, so the frame leaves at once and
        // its place takes no room.
        await expect(firstFrame(page)).toHaveCount(0);
        await expectNoRoom(page);

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
        await expectNoRoom(page);
        expect(requests()).toBe(before);
      });
    })
  );
});
