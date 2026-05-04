import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { getTranslations } from "next-intl/server";

/** Renders the shared localized not-found state for static and dynamic routes. */
export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-6 rounded-xl border bg-card/30 p-6 shadow-sm backdrop-blur-xs">
        <div className="space-y-4 text-center">
          <h1 className="font-bold font-mono text-6xl text-destructive">404</h1>

          <div className="space-y-2">
            <h2 className="font-medium text-lg tracking-tight">{t("title")}</h2>

            <p className="mx-auto max-w-md text-muted-foreground text-sm">
              {t("description")}
            </p>
          </div>

          <div className="mx-auto flex w-fit items-center gap-2">
            <a
              className={cn(buttonVariants({ variant: "secondary" }))}
              href="https://github.com/nakafaai/nakafa.com"
              rel="noopener noreferrer"
              target="_blank"
              title={t("contribute-button")}
            >
              {t("contribute-button")}
            </a>
            <NavigationLink
              className={cn(buttonVariants({ variant: "default" }))}
              href="/"
              title={t("home-button")}
            >
              {t("home-button")}
            </NavigationLink>
          </div>
        </div>
      </div>
    </div>
  );
}
