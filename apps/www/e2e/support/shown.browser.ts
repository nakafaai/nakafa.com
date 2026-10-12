import { expect, test } from "@playwright/test";
import { shownTexts, watchTexts } from "@/e2e/support/shown";

const SEEN = "Access denied";
const NEVER = "Another text";

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
