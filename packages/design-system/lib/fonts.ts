import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "./utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const fonts = cn(
  geistSans.variable,
  geistMono.variable,
  "touch-manipulation font-sans antialiased"
);
