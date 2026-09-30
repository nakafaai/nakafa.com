import { cn } from "cn";
import { GeistMono } from "geist/font/mono";
import { Inter } from "next/font/google";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export const fonts = cn(
  inter.variable,
  GeistMono.variable,
  "touch-manipulation font-sans antialiased"
);
