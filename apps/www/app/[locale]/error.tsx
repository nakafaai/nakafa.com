"use client"; // Error boundaries must be Client Components

import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { Particles } from "@repo/design-system/components/ui/particles";
import { cn } from "@repo/design-system/lib/utils";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("Error");

  useEffect(() => {
    // Log the error to an error reporting service
    // biome-ignore lint/suspicious/noConsole: never mind, so we can debug
    console.error(error);
  }, [error]);

  return (
    <div
      className={cn(
        "relative flex h-[calc(100svh-4rem)] items-center justify-center",
        pathname === "/" && "lg:h-svh"
      )}
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-6 rounded-xl border bg-card/30 p-6 shadow-sm backdrop-blur-xs">
        <div className="space-y-4 text-center">
          <h1 className="font-bold font-mono text-6xl text-primary">5XX</h1>

          <div className="space-y-2">
            <h2 className="font-mono font-semibold text-lg tracking-tight">
              {t("title")}
            </h2>

            <p className="mx-auto max-w-md text-muted-foreground text-sm">
              {t("description")}
            </p>
          </div>

          <div className="mx-auto grid w-fit grid-cols-2 gap-2">
            <Button onClick={reset} variant="secondary">
              {t("retry")}
            </Button>
            <a
              className={cn(buttonVariants({ variant: "secondary" }))}
              href="https://github.com/nakafaai/nakafa.com/issues"
              rel="noopener noreferrer"
              target="_blank"
              title="Report"
            >
              {t("report")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
