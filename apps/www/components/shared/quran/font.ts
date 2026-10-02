import { Amiri } from "next/font/google";

/**
 * The Quran typeface for Quran text. The text applies its class, so next/font
 * preloads it only on the surah pages that render it: the Arabic subset for
 * the words and the Latin subset for the spaces between them. With optional
 * display, it never swaps in after the text is laid out, so the text never
 * moves: a page view it does not reach in time keeps the system Arabic face,
 * and the next one uses the cached file.
 *
 * @see https://nextjs.org/docs/app/api-reference/components/font#preloading
 */
export const quranFont = Amiri({
  display: "optional",
  subsets: ["arabic", "latin"],
  weight: "400",
});
