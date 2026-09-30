import { Amiri } from "next/font/google";

/**
 * The Quran typeface lives with the Quran components, so Next.js preloads it
 * only on the routes that render them. Arabic text uses the regular weight.
 */
export const quranFont = Amiri({ subsets: ["latin"], weight: "400" });
