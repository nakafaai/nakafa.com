import { Geist, Geist_Mono, Noto_Naskh_Arabic } from "next/font/google";
import { cn } from "./utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const arabicSans = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
});

export const fonts = cn(
  geistSans.variable,
  geistMono.variable,
  arabicSans.variable,
  "touch-manipulation font-sans antialiased"
);
