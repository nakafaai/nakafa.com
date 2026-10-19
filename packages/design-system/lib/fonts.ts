import { cn } from "cn";
import { Inter } from "next/font/google";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export const fonts = cn(
  inter.variable,
  "touch-manipulation font-sans antialiased"
);
