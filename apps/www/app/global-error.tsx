"use client"; // Error boundaries must be Client Components

import { DesignSystemProvider } from "@repo/design-system";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { Particles } from "@repo/design-system/components/ui/particles";
import { fonts } from "@repo/design-system/lib/fonts";
import { cn } from "@repo/design-system/lib/utils";
import "@repo/design-system/styles/globals.css";
import "@repo/design-system/styles/theme.css";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    // global-error must include html and body tags
    <html className={fonts} lang="en" suppressHydrationWarning>
      <body>
        <DesignSystemProvider>
          <div className="relative">
            <div
              className="relative flex h-svh items-center justify-center"
              data-pagefind-ignore
            >
              <Particles className="pointer-events-none absolute inset-0 opacity-80" />
              <div className="mx-6 rounded-xl border bg-card/30 p-6 shadow-sm backdrop-blur-xs">
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
                    <Button onClick={reset} variant="secondary">
                      Retry
                    </Button>
                    <a
                      className={cn(buttonVariants({ variant: "secondary" }))}
                      href="https://github.com/nakafaai/nakafa.com/issues"
                      rel="noopener noreferrer"
                      target="_blank"
                      title="Report"
                    >
                      Report
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DesignSystemProvider>
      </body>
    </html>
  );
}
