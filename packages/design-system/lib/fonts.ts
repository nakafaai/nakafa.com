import { cn } from "cn";
import { GeistMono } from "geist/font/mono";
import {
  GeistPixelCircle,
  GeistPixelGrid,
  GeistPixelLine,
  GeistPixelSquare,
  GeistPixelTriangle,
} from "geist/font/pixel";
import { Amiri, Inter } from "next/font/google";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export const quranSans = Amiri({
  variable: "--font-quran",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const fonts = cn(
  inter.variable,
  GeistMono.variable,
  GeistPixelSquare.variable,
  GeistPixelGrid.variable,
  GeistPixelCircle.variable,
  GeistPixelTriangle.variable,
  GeistPixelLine.variable,
  quranSans.variable,
  "touch-manipulation font-sans antialiased"
);
