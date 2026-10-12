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
