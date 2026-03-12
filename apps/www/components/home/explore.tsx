import {
  Atom02Icon,
  Brain02Icon,
  Target01Icon,
  Timer02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";

function SubjectIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200/50 transition-all duration-300 group-hover:-translate-y-1 dark:bg-[#27272A] dark:ring-white/5">
        <div className="h-1 w-5 rounded-full bg-[#5B78F6]/30 dark:bg-[#5B78F6]/40" />
        <div className="h-1 w-full rounded-full bg-[#5B78F6]/30 dark:bg-[#5B78F6]/40" />
        <div className="h-1 w-3/4 rounded-full bg-[#5B78F6]/30 dark:bg-[#5B78F6]/40" />

        <div className="absolute -right-2 bottom-1 z-20 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[#F5B041] text-white shadow-sm ring-[3px] ring-zinc-50 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:ring-[#18181B]">
          <HugeIcons className="size-3" icon={Atom02Icon} />
        </div>

        <div className="absolute -bottom-2 -left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#5B78F6] text-white shadow-sm ring-4 ring-zinc-50 transition-all duration-300 group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:ring-[#18181B]">
          <HugeIcons className="size-4.5" icon={Brain02Icon} />
        </div>
      </div>
    </div>
  );
}

function SNBTIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col justify-between rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-zinc-200/50 transition-all duration-300 group-hover:-translate-y-1 dark:bg-[#27272A] dark:ring-white/5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 shrink-0 rounded-full bg-[#61C180]/30 dark:bg-[#61C180]/40" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-0.75 w-full rounded-full bg-zinc-200 dark:bg-zinc-600/60" />
            <div className="h-0.75 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-600/60" />
          </div>
        </div>
        <div className="h-0.75 w-full rounded-full bg-[#61C180]/30 dark:bg-[#61C180]/40" />

        <div className="absolute -bottom-2 -left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#61C180] text-white shadow-sm ring-4 ring-zinc-50 transition-all duration-300 group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:ring-[#18181B]">
          <HugeIcons className="size-4.5" icon={Timer02Icon} />
        </div>

        <div className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#E46A54] text-white shadow-sm ring-4 ring-zinc-50 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:ring-[#18181B]">
          <HugeIcons className="size-3.5" icon={Target01Icon} />
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
          className="group flex flex-col items-center gap-4 outline-none"
          href="/subject"
        >
          <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-[28px] bg-zinc-50 transition-all duration-300 group-hover:bg-zinc-100 group-focus-visible:ring-2 group-focus-visible:ring-ring dark:bg-[#18181B] dark:group-hover:bg-[#1f1f23]">
            <SubjectIcon />
          </div>
          <span className="text-zinc-900 dark:text-zinc-100">
            {t("subject")}
          </span>
        </NavigationLink>

        <NavigationLink
          className="group flex flex-col items-center gap-4 outline-none"
          href="/exercises"
        >
          <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-[28px] bg-zinc-50 transition-all duration-300 group-hover:bg-zinc-100 group-focus-visible:ring-2 group-focus-visible:ring-ring dark:bg-[#18181B] dark:group-hover:bg-[#1f1f23]">
            <SNBTIcon />
          </div>
          <span className="text-zinc-900 dark:text-zinc-100">SNBT Try out</span>
        </NavigationLink>
      </div>
    </section>
  );
}
