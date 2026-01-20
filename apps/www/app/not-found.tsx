"use client";

import "@repo/design-system/styles/globals.css";
import "@repo/design-system/styles/theme.css";

import { DesignSystemProvider } from "@repo/design-system";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import { Particles } from "@repo/design-system/components/ui/particles";
import { fonts } from "@repo/design-system/lib/fonts";
import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";

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
          <div
            className="relative flex h-svh items-center justify-center"
            data-pagefind-ignore
          >
            <Particles className="pointer-events-none absolute inset-0 opacity-80" />
            <div className="mx-6 rounded-xl border bg-card/30 p-6 shadow-sm backdrop-blur-xs">
              <div className="space-y-4 text-center">
                <h1 className="font-bold font-mono text-6xl text-destructive">
                  404
                </h1>

                <div className="space-y-2">
                  <h2 className="font-mono font-semibold text-lg tracking-tight">
                    Page Not Found
                  </h2>

                  <p className="mx-auto max-w-md text-muted-foreground text-sm">
                    Oops! The page you are looking for does not exist or has not
                    been implemented yet.
                  </p>
                </div>

                <div className="mx-auto flex w-fit items-center gap-2">
                  <a
                    className={cn(buttonVariants({ variant: "secondary" }))}
                    href="https://github.com/nakafaai/nakafa.com"
                    rel="noopener noreferrer"
                    target="_blank"
                    title="Contribute"
                  >
                    Contribute
                  </a>
                  <Link
                    className={cn(buttonVariants({ variant: "default" }))}
                    href="/"
                    title="Home"
                  >
                    Home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </DesignSystemProvider>
      </body>
    </html>
  );
}
