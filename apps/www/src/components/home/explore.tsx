import {
  AiChat02Icon,
  AiMagicIcon,
  Atom02Icon,
  Books02Icon,
  Target01Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  getPrimaryNavigationItems,
  getPrimaryNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumTarget } from "@/lib/curriculum/preferences";
import {
  type LinkTarget,
  TargetLink,
  useCurrentLocale,
} from "@/lib/routing/link";
import { usePreferredTryoutTarget } from "@/lib/tryout/preferences";

function SubjectIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="bg-card relative flex h-14 w-16 flex-col gap-2 rounded-md border p-2.5 shadow-xs transition-transform ease-out group-hover:-translate-y-1">
        <div className="bg-chart-1/30 h-1 w-5 rounded-full" />
        <div className="bg-chart-1/30 h-1 w-full rounded-full" />
        <div className="bg-chart-1/30 h-1 w-3/4 rounded-full" />

        <div className="border-card bg-chart-3 text-background absolute -right-2 bottom-1 flex size-5.5 items-center justify-center rounded-full border-2 shadow-xs transition-transform ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3" icon={Atom02Icon} />
        </div>

        <div className="border-card bg-chart-1 text-background absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 shadow-xs transition-transform ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={Books02Icon} />
        </div>
      </div>
    </div>
  );
}

function TryoutIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="bg-card relative flex h-14 w-16 flex-col justify-between rounded-md border p-2.5 shadow-xs transition-transform ease-out group-hover:-translate-y-1">
        <div className="flex items-center gap-2">
          <div className="bg-chart-2/30 size-4 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="bg-muted h-0.75 w-full rounded-full" />
            <div className="bg-muted h-0.75 w-2/3 rounded-full" />
          </div>
        </div>
        <div className="bg-chart-2/30 h-0.75 w-full rounded-full" />

        <div className="border-card bg-chart-2 text-background absolute -bottom-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 shadow-xs transition-transform ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={Timer02Icon} />
        </div>

        <div className="border-card bg-chart-5 text-background absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border-2 shadow-xs transition-transform ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3.5" icon={Target01Icon} />
        </div>
      </div>
    </div>
  );
}

function NinaIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative h-14 w-16 transition-transform ease-out group-hover:-translate-y-1">
        <div className="bg-card relative flex h-14 w-16 flex-col justify-between rounded-md border p-2.5 shadow-xs">
          <div className="bg-chart-2/40 ml-auto h-1 w-7 rounded-full" />
          <div className="bg-chart-1/30 ml-auto h-1 w-10 rounded-full" />
          <div className="bg-chart-3/60 ml-auto h-1 w-6 rounded-full" />

          <div className="bg-chart-1/15 mt-1 flex w-fit items-center gap-1 rounded-full px-1.5 py-1">
            <div className="bg-chart-1 size-1 rounded-full" />
            <div className="bg-chart-2 size-1 rounded-full" />
            <div className="bg-chart-1 size-1 rounded-full" />
          </div>
        </div>

        <div className="border-card bg-chart-1 text-background absolute -top-2 -left-2 flex size-9 items-center justify-center rounded-full border-2 shadow-xs transition-transform ease-out group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-4.5" icon={AiChat02Icon} />
        </div>

        <div className="border-card bg-chart-2 text-background absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-full border-2 shadow-xs transition-transform ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:scale-110">
          <HugeIcons className="size-3.5" icon={AiMagicIcon} />
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the home exploration shortcuts from the same canonical route helpers
 * used by sidebar and sitemap navigation. Only the signed-in home mounts it, behind
 * the account gate and under the app's Convex provider, so it reads the learner's
 * preferences directly.
 */
export function HomeExplore() {
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const locale = useCurrentLocale();
  // The shared shortcuts are the same for every audience; only their resolved
  // destinations follow the learner preferences below.
  const items = getPrimaryNavigationItems();
  const preferences = {
    preferredCurriculumTarget: usePreferredCurriculumTarget(locale),
    preferredTryoutTarget: usePreferredTryoutTarget(locale),
  };
  const exploreCards = {
    askNina: { icon: <NinaIcon />, title: tAi("ask-nina") },
    subject: { icon: <SubjectIcon />, title: tCommon("subject") },
    tryOut: { icon: <TryoutIcon />, title: tCommon("try-out") },
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {Arr.map(items, (item) => (
          <ExploreCard
            key={item.id}
            target={getPrimaryNavigationTarget(item, preferences)}
            title={exploreCards[item.id].title}
          >
            {exploreCards[item.id].icon}
          </ExploreCard>
        ))}
      </div>
    </section>
  );
}

function ExploreCard({
  children,
  title,
  ...link
}: {
  children: ReactNode;
  target: LinkTarget;
  title: string;
}) {
  return (
    <TargetLink className="group flex flex-col items-center gap-2" {...link}>
      <div className="bg-card flex aspect-[1/0.95] w-full items-center justify-center rounded-xl border">
        <div className="scale-75 sm:scale-100">{children}</div>
      </div>
      <h2 className="text-center text-sm sm:text-base">{title}</h2>
    </TargetLink>
  );
}
