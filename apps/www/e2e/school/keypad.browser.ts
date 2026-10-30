import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** The widths the keypad is measured at, from the narrowest phone to a desktop. */
const WIDTHS = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1440 },
] as const;

/**
 * How far a letter's ink centre may lie from its key's centre. One face sets one baseline for every letter, and the
 * letters' ink spans from the hamza above alef to the tails of jim and mim, so the face balances them about the centre.
 */
const LETTER_OFFSET_MAX = 6;

/** How far a mark key's dotted circle may lie from its key's centre. */
const CIRCLE_OFFSET_MAX = 1;

/**
 * Runs in the page: each key's glyph ink against its key, from the run's place on the page and the face's ink on a
 * canvas, and the keypad against its popover, the viewport, and the page's width.
 */
function measureKeypad() {
  const keypad = document.querySelector('[data-slot="arabic-keypad"]');
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (keypad === null || context === null) {
    return null;
  }
  const size = 200;
  // The ink rows and columns of a text at `size` px, in em from the baseline and the run's start; a band of rows
  // about the baseline is skipped for a mark, whose tatweel stroke is left unpainted.
  const inkOf = (font: string, text: string, skip: boolean) => {
    canvas.width = size * 4;
    canvas.height = size * 4;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${size}px ${font}`;
    context.fillText(text, size * 1.5, size * 2);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (let row = 0; row < canvas.height; row += 1) {
      const em = (row - size * 2) / size;
      if (skip && em >= -0.1 && em <= 0.02) {
        continue;
      }
      for (let column = 0; column < canvas.width; column += 1) {
        if (pixels[(row * canvas.width + column) * 4 + 3] > 24) {
          top = Math.min(top, row);
          bottom = Math.max(bottom, row + 1);
          left = Math.min(left, column);
          right = Math.max(right, column + 1);
        }
      }
    }
    return {
      ascent: context.measureText(text).fontBoundingBoxAscent / size,
      bottom: (bottom - size * 2) / size,
      left: (left - size * 1.5) / size,
      right: (right - size * 1.5) / size,
      top: (top - size * 2) / size,
    };
  };
  const keys = [];
  for (const button of keypad.querySelectorAll("button")) {
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    const host = node?.parentElement;
    const text = node?.textContent ?? "";
    if (host == null || !/[؀-ۿ]/.test(text)) {
      continue;
    }
    const style = getComputedStyle(host);
    const fontSize = Number.parseFloat(style.fontSize);
    const mark = text.startsWith("ـ");
    const ink = inkOf(style.fontFamily, text, mark);
    const range = document.createRange();
    range.selectNodeContents(host);
    const run = range.getBoundingClientRect();
    const key = button.getBoundingClientRect();
    const border = getComputedStyle(button);
    const baseline = run.top + ink.ascent * fontSize;
    const circle = button
      .querySelector(".rounded-full")
      ?.getBoundingClientRect();
    const top = Math.min(
      baseline + ink.top * fontSize,
      circle?.top ?? Number.POSITIVE_INFINITY
    );
    const bottom = Math.max(
      baseline + ink.bottom * fontSize,
      circle?.bottom ?? Number.NEGATIVE_INFINITY
    );
    const centre =
      circle === undefined
        ? (top + bottom) / 2
        : (circle.top + circle.bottom) / 2;
    keys.push({
      inside:
        top >= key.top + Number.parseFloat(border.borderTopWidth) &&
        bottom <= key.bottom - Number.parseFloat(border.borderBottomWidth) &&
        run.left + ink.left * fontSize >= key.left &&
        run.left + ink.right * fontSize <= key.right,
      mark,
      offset: centre - (key.top + key.bottom) / 2,
      text: text.trim(),
    });
  }
  const box = keypad.getBoundingClientRect();
  const popup = keypad
    .closest('[data-slot="popover-content"]')
    ?.getBoundingClientRect();
  return {
    keypadInPopup:
      popup !== undefined &&
      box.left >= popup.left - 0.5 &&
      box.right <= popup.right + 0.5,
    keys,
    pageWide:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    popupInView:
      popup !== undefined &&
      popup.left >= -0.5 &&
      popup.right <= innerWidth + 0.5,
  };
}

test("every key of the Arabic keypad holds its glyph inside its border near its centre, and the keypad fits the screen, at every width", async ({
  browser,
  baseURL,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext();
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  await page.getByRole("button", { name: "Create exam" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill("Kunci Arab");
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const editor = page.url();
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  const toolbar = page.locator('[data-slot="editor-toolbar"]');
  const keypad = page.locator('[data-slot="arabic-keypad"]');

  for (const viewport of WIDTHS) {
    await page.setViewportSize(viewport);
    await page.goto(editor);
    await expect(prompt).toBeEditable({
      timeout: readinessTimeoutMilliseconds,
    });
    await prompt.click();
    // A narrow toolbar holds the keyboard in its overflow.
    const keyboard = toolbar.getByRole("button", { name: "Arabic keyboard" });
    if (!(await keyboard.isVisible())) {
      await toolbar.getByRole("button", { name: "More" }).click();
    }
    await page.getByRole("button", { name: "Arabic keyboard" }).last().click();
    await expect(keypad).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.fonts).some(
            (face) =>
              face.family === "Amiri Quran Keys" && face.status === "loaded"
          )
        )
      )
      .toBe(true);

    const measured = await page.evaluate(measureKeypad);
    expect(measured).not.toBeNull();
    if (measured === null) {
      return;
    }
    const at = `at ${viewport.width}px`;
    expect(measured.keys.length, at).toBe(47);
    for (const key of measured.keys) {
      expect(key.inside, `${key.text} ${at}`).toBe(true);
      expect(Math.abs(key.offset), `${key.text} ${at}`).toBeLessThanOrEqual(
        key.mark ? CIRCLE_OFFSET_MAX : LETTER_OFFSET_MAX
      );
    }
    expect(measured.keypadInPopup, at).toBe(true);
    expect(measured.popupInView, at).toBe(true);
    expect(measured.pageWide, at).toBe(false);
  }
  await context.close();
});
