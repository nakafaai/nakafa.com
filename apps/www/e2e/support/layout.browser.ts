import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Schema } from "effect";
import { recordLayoutShifts } from "./layout";
import { TOASTER } from "./selector";

const KEY = "nakafaProbeShifts";

/** What each recorded shift moved, one line per shift, in the order the recorder held them. */
const readShifts = async (page: Page) =>
  Arr.map(
    Schema.decodeUnknownSync(
      Schema.Array(Schema.Struct({ sources: Schema.Array(Schema.String) }))
    )(await page.evaluate((key) => Reflect.get(window, key), KEY)),
    (shift) => Arr.join(shift.sources, "; ")
  );

/** Waits for the frame that follows the change a step made, so the browser has reported it. */
const nextFrame = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

/**
 * Opens a blank document with a page and a toaster, and starts the recorder.
 * The content replaces the blank document without a navigation, so an init
 * script would not run for it: the recorder starts from here, as the shell
 * starts it, and the page has not shifted before. The recorder is under test,
 * not a product page.
 */
const openToaster = async (page: Page, toasterPosition: "fixed" | "static") => {
  await page.setContent(
    `<!doctype html><title>recorder</title>
     <style>
       body { margin: 0; }
       .page { background: #eee; height: 200px; }
       ol { bottom: 0; left: 0; list-style: none; margin: 0; padding: 0; position: ${toasterPosition}; width: 300px; }
       li { background: #ccc; height: 100px; }
     </style>
     <div class="page">page</div>
     <ol class="toaster" data-sonner-toaster><li class="toast">toast</li></ol>`
  );
  await page.evaluate(recordLayoutShifts, { key: KEY, overlay: TOASTER });
  await nextFrame(page);
  expect(await readShifts(page)).toEqual([]);
};

/**
 * The recorder must keep the shift of the page, or a test that waits for a
 * still page would pass on one that moves. It must leave out the shift of a
 * toaster that is fixed to the viewport, which stacks over the page and
 * animates its own height. A recorder that left out nothing would fail at the
 * move of the page, because it would hold the toast first, and one that left
 * out everything would fail there too, holding nothing.
 */
test("the layout shift recorder leaves out a fixed toaster and keeps the page", async ({
  page,
}) => {
  await openToaster(page, "fixed");

  // The toast shrinks and its top edge moves down, as an older toast does when
  // a newer one arrives.
  await page.evaluate(() => {
    const toast = document.querySelector("li");
    if (toast) {
      toast.style.height = "60px";
    }
  });
  await nextFrame(page);

  // The page moves down. The recorder holds the shifts in the order the
  // browser reported them, so when this is the only one, the toast is out.
  await page.evaluate(() => {
    document.body.style.paddingTop = "50px";
  });
  await expect
    .poll(() => readShifts(page))
    .toEqual([expect.stringContaining('class="page"')]);
});

/**
 * A toaster that sits in the flow of the page is the page: when the content
 * above it grows, it moves down, and that is a shift the page made. A recorder
 * that left out a toaster wherever it sits would hold nothing here.
 */
test("the layout shift recorder keeps a toaster that sits in the flow of the page", async ({
  page,
}) => {
  await openToaster(page, "static");

  // The page grows, and the toaster below it moves down with its toast.
  await page.evaluate(() => {
    const content = document.querySelector(".page");
    if (content instanceof HTMLElement) {
      content.style.height = "250px";
    }
  });

  await expect
    .poll(() => readShifts(page))
    .toEqual([expect.stringContaining('class="toast')]);
});
