import { Certificate02Icon, TaskDone02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export function SnbtTryoutIcon() {
  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col justify-between rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 shrink-0 rounded-full bg-pink-500/20 dark:bg-pink-400/20" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-0.75 w-full rounded-full bg-muted" />
            <div className="h-0.75 w-2/3 rounded-full bg-muted" />
          </div>
        </div>
        <div className="h-0.75 w-full rounded-full bg-pink-500/20 dark:bg-pink-400/20" />

        <div className="absolute -bottom-2 -left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-pink-500 text-white shadow-xs transition-all ease-out group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-110 dark:bg-pink-600">
          <HugeIcons className="size-4.5" icon={TaskDone02Icon} />
        </div>

        <div className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-pink-500 text-white shadow-xs transition-all ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110 dark:bg-pink-600">
          <HugeIcons className="size-3.5" icon={Certificate02Icon} />
        </div>
      </div>
    </div>
  );
}
