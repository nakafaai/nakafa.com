"use client";

import { ThemeProvider } from "@/components/theme/provider";
import { cn } from "@/lib/utils";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import NextError from "next/error";

import "@/styles/globals.css";

export default function NotFound() {
  return (
    <html
      lang="en"
      className={cn(
        "font-sans antialiased",
        GeistSans.variable,
        GeistMono.variable
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
