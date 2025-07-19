import { Amiri, Geist, Geist_Mono } from "next/font/google";
import { cn } from "./utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const quranSans = Amiri({
  variable: "--font-quran",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const fonts = cn(
  geistSans.variable,
  geistMono.variable,
  quranSans.variable,
  "touch-manipulation font-sans antialiased"
);
