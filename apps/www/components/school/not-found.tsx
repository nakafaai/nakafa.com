import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

export function SchoolNotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className="relative flex h-svh items-center justify-center">
      <Particles className="-z-1 pointer-events-none absolute inset-0 opacity-80" />
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

          <div className="mx-auto flex w-fit items-center gap-2">
            <NavigationLink
              className={cn(buttonVariants({ variant: "default" }))}
              href="/school"
              title={t("home-button")}
            >
              {t("home-button")}
            </NavigationLink>
          </div>
        </div>
      </div>
    </main>
  );
}
