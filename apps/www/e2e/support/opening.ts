import { expect, type Locator, type Page } from "@playwright/test";
import { Array as Arr } from "effect";
import {
  readPaints,
  recordedMilliseconds,
  recordPaints,
  summarizePaints,
} from "@/e2e/support/paint";

/** The body of a dialog, a drawer or a sheet. */
const POPUP_BODY =
  '[data-slot="dialog-panel"],[data-slot="drawer-panel"],[data-slot="sheet-panel"]';

/** How long a popup is watched from the press on, past its open animation. */
const RECORD_MILLISECONDS = 900;

/**
 * Presses `control` and watches the popup it opens, frame by frame. The owner's rule (1 Nov): a popup opens with its
 * content in place, so its body shows at its final height in the first frame a reader sees it, and it never loses that
 * height or goes away while it opens. A query that gates the body, a skeleton that swaps in and a body that mounts after
 * the frame all fail here.
 */
export async function expectPopupOpensWhole(page: Page, control: Locator) {
  await recordPaints(page, {
    contains: "",
    duration: RECORD_MILLISECONDS,
    selector: POPUP_BODY,
  });
  await control.click();
  await expect
    .poll(() => recordedMilliseconds(page), {
      timeout: RECORD_MILLISECONDS * 4,
    })
    .toBeGreaterThanOrEqual(RECORD_MILLISECONDS);

  const samples = await readPaints(page);
  const summary = summarizePaints(samples);
  expect(summary?.firstHeight ?? 0).toBeGreaterThan(0);
  expect(summary?.firstHeight).toBe(summary?.finalHeight);
  expect(summary?.drift ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(0.5);
  const seen = Arr.dropWhile(samples, (sample) => !sample.shown);
  expect(Arr.filter(seen, (sample) => !sample.shown)).toEqual([]);
}
