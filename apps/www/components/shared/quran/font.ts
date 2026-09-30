import { Amiri } from "next/font/google";

/**
 * The Quran typeface lives with the Quran components, so Next.js preloads it
 * only on the routes that render them. Verses need the Arabic subset for their
 * words and the Latin subset for the spaces between them, so both preload and
 * verses do not repaint when the font arrives. Arabic text uses the regular
 * weight.
 */
export const quranFont = Amiri({ subsets: ["arabic", "latin"], weight: "400" });
