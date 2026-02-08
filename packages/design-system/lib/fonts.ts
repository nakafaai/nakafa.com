import { GeistMono } from "geist/font/mono";
import {
  GeistPixelCircle,
  GeistPixelGrid,
  GeistPixelLine,
  GeistPixelSquare,
  GeistPixelTriangle,
} from "geist/font/pixel";
import { GeistSans } from "geist/font/sans";
import { Amiri } from "next/font/google";
import { cn } from "./utils";

export const quranSans = Amiri({
  variable: "--font-quran",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const fonts = cn(
  GeistSans.variable,
  GeistMono.variable,
  GeistPixelSquare.variable,
  GeistPixelGrid.variable,
  GeistPixelCircle.variable,
  GeistPixelTriangle.variable,
  GeistPixelLine.variable,
  quranSans.variable,
  "touch-manipulation font-sans antialiased"
);
