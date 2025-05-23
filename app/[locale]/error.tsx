"use client"; // Error boundaries must be Client Components

import { Button, buttonVariants } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
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
      data-pagefind-ignore
      className={cn(
        "relative flex h-[calc(100svh-4rem)] items-center justify-center",
        pathname === "/" && "lg:h-svh"
      )}
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-6 rounded-xl border bg-card/80 p-6 shadow-sm backdrop-blur-xs">
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
            <Button variant="secondary" onClick={reset}>
              {t("retry")}
            </Button>
            <a
              href="https://github.com/nabilfatih/nakafa.com/issues"
              title="Report"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              {t("report")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
