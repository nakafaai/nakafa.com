import { buttonVariants } from "@repo/design-system/components/ui/button";
import { Particles } from "@repo/design-system/components/ui/particles";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div
      data-pagefind-ignore
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center"
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-6 rounded-xl border bg-card/30 p-6 shadow-sm backdrop-blur-xs">
        <div className="space-y-4 text-center">
          <h1 className="font-bold font-mono text-6xl text-primary">404</h1>

          <div className="space-y-2">
            <h2 className="font-mono font-semibold text-lg tracking-tight">
              {t("title")}
            </h2>

            <p className="mx-auto max-w-md text-muted-foreground text-sm">
              {t("description")}
            </p>
          </div>

          <div className="mx-auto w-fit">
            <a
              href="https://github.com/nakafaai/nakafa.com"
              title={t("contribute-button")}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              {t("contribute-button")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
