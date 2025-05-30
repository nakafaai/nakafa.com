"use client"; // Error boundaries must be Client Components

import { ThemeProvider } from "@/components/theme/provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { themes } from "@/lib/data/theme";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import "@/styles/theme.css";
import { Geist, Geist_Mono } from "next/font/google";
import { useEffect } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    // biome-ignore lint/suspicious/noConsole: never mind, so we can debug
    console.error(error);
  }, [error]);

  return (
    // global-error must include html and body tags
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
          themes={themes.map((t) => t.value)}
        >
          <div className="relative">
            <div
              data-pagefind-ignore
              className="relative flex h-svh items-center justify-center"
            >
              <Particles className="pointer-events-none absolute inset-0 opacity-80" />
              <div className="mx-6 rounded-xl border bg-card/80 p-6 shadow-sm backdrop-blur-xs">
                <div className="space-y-4 text-center">
                  <h1 className="font-bold font-mono text-6xl text-primary">
                    5XX
                  </h1>

                  <div className="space-y-2">
                    <h2 className="font-mono font-semibold text-lg tracking-tight">
                      Something went wrong!
                    </h2>

                    <p className="mx-auto max-w-md text-muted-foreground text-sm">
                      Please report the issue on GitHub.
                    </p>
                  </div>

                  <div className="mx-auto grid w-fit grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={reset}>
                      Retry
                    </Button>
                    <a
                      href="https://github.com/nakafaai/nakafa.com/issues"
                      title="Report"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "secondary" }))}
                    >
                      Report
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
