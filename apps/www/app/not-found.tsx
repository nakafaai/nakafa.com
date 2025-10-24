"use client";

import { DesignSystemProvider } from "@repo/design-system";
import { cn } from "@repo/design-system/lib/utils";
import NextError from "next/error";
import { Geist, Geist_Mono } from "next/font/google";

import "@repo/design-system/styles/globals.css";
import "@repo/design-system/styles/theme.css";

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
      className={cn(
        "font-sans antialiased",
        geistSans.variable,
        geistMono.variable,
      )}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <DesignSystemProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <NextError statusCode={404} />
        </DesignSystemProvider>
      </body>
    </html>
  );
}
