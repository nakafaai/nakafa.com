"use client";

import "@repo/design-system/styles/globals.css";
import "@repo/design-system/styles/theme.css";

import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import NextError from "next/error";

export default function NotFound() {
  return (
    <html className={fonts} lang="en" suppressHydrationWarning>
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
