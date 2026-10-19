import type { Page } from "@playwright/test";
import { Schema } from "effect";

/** The page global that holds the texts the document has shown since `watchTexts`. */
const SHOWN = "nakafaShownTexts";

/**
 * Starts recording, inside the page, which of `texts` the document shows from
 * now on. The page looks at every change of the document, so a text that shows
 * for a moment between two steps of a test is still caught, which a locator
 * assertion cannot do: it reads the page only when it runs. Only the text a
 * learner could see counts: the rendered text, which leaves out scripts and
 * hidden elements. The page's own scripts hold every text of its dictionary,
 * so the text of the document would hold each of them all along. A page that
 * moves on by client navigation keeps the record, and a page that loads again
 * starts without it.
 */
export const watchTexts = (page: Page, texts: readonly string[]) =>
  page.evaluate(
    ({ key, needles }) => {
      const shown: string[] = [];
      Reflect.set(window, key, shown);
      const look = () => {
        const text = document.body.innerText;
        for (const needle of needles) {
          if (text.includes(needle) && !shown.includes(needle)) {
            shown.push(needle);
          }
        }
      };
      new MutationObserver(look).observe(document, {
        characterData: true,
        childList: true,
        subtree: true,
      });
      look();
    },
    { key: SHOWN, needles: texts }
  );

/** The texts that `watchTexts` saw the document show, in the order they first showed. */
export const shownTexts = async (page: Page) =>
  Schema.decodeUnknownSync(Schema.Array(Schema.String))(
    await page.evaluate((key) => Reflect.get(window, key), SHOWN)
  );

/** The page global that holds the most copies of a text that one frame showed. */
const COPIES = "nakafaMostCopies";

/**
 * Starts counting, in every animation frame from now on, the elements that
 * match `selector`, hold `text` and that a reader can see. The page keeps the
 * most that any one frame showed. Only a frame counts, because the document
 * can hold a second copy that a reader never sees: the page the router hides when
 * a learner leaves it keeps its elements until React renders them again. A page
 * that moves on by client navigation keeps the count, and a page that loads
 * again starts without it.
 */
export const watchCopies = (page: Page, selector: string, text: string) =>
  page.evaluate(
    ({ key, needle, query }) => {
      const record = { most: 0 };
      Reflect.set(window, key, record);
      const look = () => {
        const shown = [...document.querySelectorAll(query)].filter(
          (element) =>
            element.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            }) && (element.textContent ?? "").includes(needle)
        );
        record.most = Math.max(record.most, shown.length);
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    },
    { key: COPIES, needle: text, query: selector }
  );

/** The most copies of the text that `watchCopies` saw in one frame. */
export const mostCopies = async (page: Page) =>
  Schema.decodeUnknownSync(Schema.Struct({ most: Schema.Finite }))(
    await page.evaluate((key) => Reflect.get(window, key), COPIES)
  ).most;
