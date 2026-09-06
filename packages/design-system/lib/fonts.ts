import { cn } from "@repo/design-system/lib/utils";
import { GeistMono } from "geist/font/mono";
import {
  GeistPixelCircle,
  GeistPixelGrid,
  GeistPixelLine,
  GeistPixelSquare,
  GeistPixelTriangle,
} from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import { Amiri, Newsreader } from "next/font/google";

const newsreader = Newsreader({
  axes: ["opsz"],
  display: "swap",
  subsets: ["latin"],
  variable: "--font-newsreader",
});

export const quranSans = Amiri({
  variable: "--font-quran",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const fonts = cn(
  GeistSans.variable,
  GeistMono.variable,
  newsreader.variable,
  GeistPixelSquare.variable,
  GeistPixelGrid.variable,
  GeistPixelCircle.variable,
  GeistPixelTriangle.variable,
  GeistPixelLine.variable,
  quranSans.variable,
  "touch-manipulation font-sans antialiased"
);
