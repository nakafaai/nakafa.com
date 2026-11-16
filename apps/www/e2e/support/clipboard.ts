import type { Page } from "@playwright/test";

/** The window property that holds what the page wrote to the clipboard, oldest first. */
const COPIES_KEY = "nakafaCopies";

/**
 * Records each text the page writes to the clipboard, before the browser writes it, so a spec reads
 * what a press copied the same way in every engine. Firefox grants a page no clipboard permission and
 * WebKit no write permission, so reading the clipboard back works in Chromium alone. The browser
 * still writes, so a write it refuses still fails the press.
 */
export const recordCopies = (page: Page) =>
  page.addInitScript((key) => {
    const copies: string[] = [];
    Object.defineProperty(window, key, { value: copies });
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (text) => {
      copies.push(text);
      return write(text);
    };
  }, COPIES_KEY);

/** The last text the page wrote to the clipboard since `recordCopies`, or none. */
export const lastCopy = (page: Page) =>
  page.evaluate((key) => {
    const copies: unknown = Reflect.get(window, key);
    return Array.isArray(copies) ? String(copies.at(-1) ?? "") : "";
  }, COPIES_KEY);
