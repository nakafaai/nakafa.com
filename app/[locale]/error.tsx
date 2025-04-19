"use client"; // Error boundaries must be Client Components

import { Button, buttonVariants } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { usePathname } from "@/i18n/routing";
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
        "relative flex h-[calc(100vh-4rem)] items-center justify-center",
        pathname === "/" && "h-dvh"
      )}
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="px-6 text-center">
        <div className="space-y-4">
          <h1 className="font-bold text-6xl">5XX</h1>

          <div className="space-y-2">
            <h2 className="font-semibold text-lg">{t("title")}</h2>

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
