import { Atom02Icon, Books02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { SnbtTryoutArt } from "@/components/tryout/snbt-art";

function SubjectIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-2 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-1 w-5 rounded-full bg-chart-1/30" />
        <div className="h-1 w-full rounded-full bg-chart-1/30" />
        <div className="h-1 w-3/4 rounded-full bg-chart-1/30" />

        <div className="absolute -right-2 bottom-1 z-20 flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 border-card bg-chart-3 text-background shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3" icon={Atom02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-chart-1 text-background shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={Books02Icon} />
        </div>
      </div>
    </div>
  );
}

export function HomeExplore() {
  const t = useTranslations("Common");

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
        <NavigationLink
          className="group flex flex-col items-center gap-2"
          href="/subject"
        >
          <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-xl bg-muted/50 transition-all ease-out group-hover:bg-muted">
            <SubjectIcon />
          </div>
          <h2>{t("explore-grades")}</h2>
        </NavigationLink>

        <NavigationLink
          className="group flex flex-col items-center gap-2"
          href="/try-out"
        >
          <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-xl bg-muted/50 transition-all ease-out group-hover:bg-muted">
            <SnbtTryoutArt />
          </div>
          <h2>{t("try-out")}</h2>
        </NavigationLink>
      </div>
    </section>
  );
}
