import { Amiri } from "next/font/google";

/**
 * The Quran typeface. The root layout applies its variable, so its font faces
 * ship in the global stylesheet and a prefetched Quran route adds no font or
 * stylesheet preloads to the page that prefetched it. Browsers download a
 * declared font only when text uses it, so only pages with Quran text fetch
 * it: the Arabic subset for the words and the Latin subset for the spaces
 * between them. Quran text waits for the typeface instead of flashing a
 * fallback that can lack Quranic marks, and its fixed line height keeps the
 * layout still when the typeface arrives. Arabic text uses the regular weight.
 */
export const quranFont = Amiri({
  display: "block",
  preload: false,
  subsets: ["arabic", "latin"],
  variable: "--font-amiri",
  weight: "400",
});
