import { expect, test } from "@playwright/test";
import {
  mostCopies,
  shownTexts,
  watchCopies,
  watchTexts,
} from "./shown";

const SEEN = "Access denied";
const NEVER = "Another text";
const COPY = "Why is the derivative of sine the cosine?";

/**
 * The recorder must hold a text that came and went before the test looked, or
 * a test that waits for a text never to show would pass on a page that showed
 * it for a moment. It must also say nothing of a text the page never showed.
 * The page's scripts hold the whole dictionary of its texts, and a hidden
 * element holds its text too: neither is something a learner sees, so neither
 * counts. A recorder that read the text of the document would count both.
 */
test("the text recorder holds a text that showed only for a moment", async ({
  page,
}) => {
  // A blank document: the recorder is under test, not a product page.
  await page.setContent(
    `<!doctype html><title>recorder</title><main></main>
     <script type="application/json">{"title":"${SEEN}"}</script>
     <div hidden>${SEEN}</div>`
  );
  await watchTexts(page, [SEEN, NEVER]);
  expect(await shownTexts(page)).toEqual([]);

  // The text is gone in the same task that shows it. The page looks at a change
  // in a microtask that the change itself queues, which runs before this one.
  await page.evaluate((text) => {
    const main = document.querySelector("main");
    main?.append(text);
    queueMicrotask(() => {
      main?.replaceChildren();
    });
  }, SEEN);

  await expect(page.locator("main")).toHaveText("");
  expect(await shownTexts(page)).toEqual([SEEN]);
});

/**
 * The recorder must count a copy that a reader could see in one frame, even
 * when it is gone before the test looks, or a test that waits for a prompt to
 * show once would pass on a page that showed it twice for a moment. It must
 * not count a copy that the document holds and a reader cannot see, which is
 * what the router keeps of the page a learner left. A recorder that counted the
 * elements of the document would fail the first half of this test.
 */
test("the copy recorder counts the copies one frame shows, not the ones the document holds", async ({
  page,
}) => {
  // A blank document: the recorder is under test, not a product page.
  await page.setContent(
    `<!doctype html><title>recorder</title>
     <div class="copy">${COPY}</div>
     <div class="copy" id="second" hidden>${COPY}</div>`
  );
  await watchCopies(page, ".copy", COPY);

  await expect.poll(() => mostCopies(page)).toBe(1);

  // The second copy shows in the next frame and hides before it is painted.
  // The page counts in its own callback for that frame, which was asked for
  // earlier than this one, so it runs first.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const second = document.querySelector("#second");
        second?.removeAttribute("hidden");
        requestAnimationFrame(() => {
          second?.setAttribute("hidden", "");
          resolve();
        });
      })
  );

  await expect(page.locator(".copy:visible")).toHaveCount(1);
  expect(await mostCopies(page)).toBe(2);
});
