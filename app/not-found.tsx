"use client";

import { ThemeProvider } from "@/components/theme/provider";
import { cn } from "@/lib/utils";
import NextError from "next/error";
import { Geist, Geist_Mono } from "next/font/google";

import "@/styles/globals.css";
import "@/styles/theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function NotFound() {
  return (
    <html
      lang="en"
      className={cn(
        "font-sans antialiased",
        geistSans.variable,
        geistMono.variable
      )}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextError statusCode={404} />
        </ThemeProvider>
      </body>
    </html>
  );
}
