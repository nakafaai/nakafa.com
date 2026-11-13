import { expect, type Page, test } from "@playwright/test";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The pages a visitor most often lands on from another site: the home page and the School landing. */
const LANDINGS = ["/en", "/en/school"];

/** Firefox's warning for a site it classified as a bounce tracker. */
const BOUNCE_TRACKER = /bounce tracker/iu;

/** How long the page settles after it took over, longer than any of its deferred work waits to start. */
const SETTLE_MILLISECONDS = 3000;

/**
 * Counts, from the first script on, every value the page stores in the browser's local or session storage. A page
 * that stores state before the reader does anything is what Firefox classifies as a bounce tracker's.
 */
function countStorageWrites() {
  const writes: string[] = [];
  Object.defineProperty(window, "__storageWrites", { value: writes });
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    writes.push(key);
    return setItem.call(this, key, value);
  };
}

/** The keys the page stored a value under, in the order it stored them. */
const storedKeys = (page: Page) =>
  page.evaluate(() =>
    Array.from<string>(Reflect.get(window, "__storageWrites"))
  );

for (const path of LANDINGS) {
  test(`a visitor's first load of ${path} stores nothing in the browser and logs no warning`, async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") {
        warnings.push(message.text());
      }
    });
    await page.addInitScript(countStorageWrites);
    await page.goto(path, { waitUntil: "load" });
    await waitUntilTakenOver(page.locator("main").first());
    await page.waitForTimeout(SETTLE_MILLISECONDS);

    expect(await storedKeys(page)).toEqual([]);
    expect(warnings.filter((text) => BOUNCE_TRACKER.test(text))).toEqual([]);
  });
}
