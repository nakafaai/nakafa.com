import { expect, type Page, test } from "@playwright/test";
import { Schema } from "effect";
import { recordLayoutShifts } from "@/e2e/support/layout";
import { TOASTER } from "@/e2e/support/selector";

const KEY = "nakafaProbeShifts";

/** The shifts the recorder holds, in the order the browser reported them. */
const readShifts = async (page: Page) =>
  Schema.decodeUnknownSync(
    Schema.Array(Schema.Struct({ overlay: Schema.Boolean }))
  )(await page.evaluate((key) => Reflect.get(window, key), KEY));

/** Waits for the frame that follows the change a step made, so the browser has reported it. */
const nextFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

/**
 * The recorder must keep the shift of the page, or a test that waits for a
 * still page would pass on one that moves. It must mark a shift of the toasts
 * alone, which the shell leaves out because a toast stacks over the page and
 * animates its own height. A recorder that marked nothing would fail the first
 * half of this test, and one that marked everything the second.
 */
test("the layout shift recorder marks a shift of the toasts and keeps one of the page", async ({
  page,
}) => {
  await page.addInitScript(recordLayoutShifts, { key: KEY, overlay: TOASTER });
  // A blank document: the recorder is under test, not a product page.
  await page.setContent(
    `<!doctype html><title>recorder</title>
     <style>
       body { margin: 0; }
       #page { background: #eee; height: 200px; }
       ol { bottom: 0; left: 0; list-style: none; margin: 0; padding: 0; position: fixed; width: 300px; }
       li { background: #ccc; height: 100px; }
     </style>
     <div id="page">page</div>
     <ol data-sonner-toaster><li data-sonner-toast>toast</li></ol>`
  );
  await nextFrame(page);
  expect(await readShifts(page)).toEqual([]);

  // The toast shrinks and its top edge moves down, as an older toast does when
  // a newer one arrives.
  await page.evaluate(() => {
    const toast = document.querySelector("li");
    if (toast) {
      toast.style.height = "60px";
    }
  });
  await nextFrame(page);
  await expect.poll(() => readShifts(page)).toEqual([{ overlay: true }]);

  // The page moves down.
  await page.evaluate(() => {
    document.body.style.paddingTop = "50px";
  });
  await nextFrame(page);
  await expect
    .poll(() => readShifts(page))
    .toEqual([{ overlay: true }, { overlay: false }]);
});
