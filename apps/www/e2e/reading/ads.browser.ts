import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Schema } from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";

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

        await nearFirstPlace(page);
        const frame = firstFrame(page);
        await expect(frame).toBeAttached();
        await expect.poll(requests).toBe(1);

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
        await note.getByRole("button", { name: "Not now" }).click();
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
        await expect(firstFrame(page)).toBeAttached();
      });

      yield* runAcceptanceCommand("xendit", learner.userId, "pass");
      yield* Effect.promise(async () => {
        // The account follows the plan live, so the frame leaves at once.
        await expect(firstFrame(page)).toHaveCount(0);

        const before = requests();
        await page.reload();
        await expect(
          page.getByRole("button").filter({ hasText: "Pro" }).first()
        ).toBeVisible();
        await nearFirstPlace(page);
        // Time for the placement's code to load and the account to answer: a
        // frame that would appear does so within it.
        await page.waitForTimeout(3000);
        await expect(firstFrame(page)).toHaveCount(0);
        expect(requests()).toBe(before);
      });
    })
  );
});
