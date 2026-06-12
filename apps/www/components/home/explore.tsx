"use client";

import {
  AiChat02Icon,
  AiMagicIcon,
  Atom02Icon,
  Books02Icon,
  Target01Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import {
  getAppNavigationViewer,
  getForYouNavigationItems,
} from "@/components/sidebar/_data/navigation";
import { useUser } from "@/lib/context/use-user";

function SubjectIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-2 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="h-1 w-5 rounded-full bg-chart-1/30" />
        <div className="h-1 w-full rounded-full bg-chart-1/30" />
        <div className="h-1 w-3/4 rounded-full bg-chart-1/30" />

        <div className="absolute -right-2 bottom-1 flex size-5.5 items-center justify-center rounded-full border-2 border-card bg-chart-3 text-background shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3" icon={Atom02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-chart-1 text-background shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={Books02Icon} />
        </div>
      </div>
    </div>
  );
}

function TryoutIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col justify-between rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex items-center gap-2">
          <div className="size-4 shrink-0 rounded-full bg-chart-2/30" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-0.75 w-full rounded-full bg-muted" />
            <div className="h-0.75 w-2/3 rounded-full bg-muted" />
          </div>
        </div>
        <div className="h-0.75 w-full rounded-full bg-chart-2/30" />

        <div className="absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-chart-2 text-background shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={Timer02Icon} />
        </div>

        <div className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-chart-5 text-background shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3.5" icon={Target01Icon} />
        </div>
      </div>
    </div>
  );
}

function NinaIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative h-14 w-16 transition-all ease-out group-hover:-translate-y-1">
        <div className="relative flex h-14 w-16 flex-col justify-between rounded-md border bg-card p-2.5 shadow-xs">
          <div className="ml-auto h-1 w-7 rounded-full bg-chart-2/40" />
          <div className="ml-auto h-1 w-10 rounded-full bg-chart-1/30" />
          <div className="ml-auto h-1 w-6 rounded-full bg-chart-3/60" />

          <div className="mt-1 flex w-fit items-center gap-1 rounded-full bg-chart-1/15 px-1.5 py-1">
            <div className="size-1 rounded-full bg-chart-1" />
            <div className="size-1 rounded-full bg-chart-2" />
            <div className="size-1 rounded-full bg-chart-1" />
          </div>
        </div>

        <div className="absolute -top-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 border-card bg-chart-1 text-background shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={AiChat02Icon} />
        </div>

        <div className="absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-full border-2 border-card bg-chart-2 text-background shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3.5" icon={AiMagicIcon} />
        </div>
      </div>
    </div>
  );
}

export function HomeExplore() {
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const role = useUser((state) => state.user?.appUser.role ?? null);
  const viewer = getAppNavigationViewer(role);
  const items = getForYouNavigationItems(viewer);
  const cardByItemId = {
    subject: {
      backgroundClassName: "bg-chart-1/10 group-hover:bg-chart-1/15",
      href: "/subject",
      title: tCommon("explore-grades"),
      visual: <SubjectIcon />,
    },
    tryOut: {
      backgroundClassName: "bg-chart-2/10 group-hover:bg-chart-2/15",
      href: "/try-out",
      title: tCommon("try-out"),
      visual: <TryoutIcon />,
    },
    askNina: {
      backgroundClassName: "bg-chart-3/15 group-hover:bg-chart-3/20",
      href: "/chat",
      title: tAi("ask-nina"),
      visual: <NinaIcon />,
    },
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
        {items.map((item) => {
          const card = cardByItemId[item.id];

          return (
            <NavigationLink
              className="group flex flex-col items-center gap-2"
              href={card.href}
              key={item.id}
            >
              <div
                className={cn(
                  "flex aspect-[1/0.95] w-full items-center justify-center rounded-xl transition-all ease-out",
                  card.backgroundClassName
                )}
              >
                {card.visual}
              </div>
              <h2>{card.title}</h2>
            </NavigationLink>
          );
        })}
      </div>
    </section>
  );
}
