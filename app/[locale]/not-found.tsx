import { buttonVariants } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div
      data-pagefind-ignore
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center"
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="px-6 text-center">
        <div className="space-y-4">
          <h1 className="font-bold text-6xl">404</h1>

          <div className="space-y-2">
            <h2 className="font-semibold text-lg">{t("title")}</h2>

            <p className="mx-auto max-w-md text-muted-foreground text-sm">
              {t("description")}
            </p>
          </div>

          <div className="mx-auto w-fit">
            <a
              href="https://github.com/nabilfatih/nakafa.com"
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
