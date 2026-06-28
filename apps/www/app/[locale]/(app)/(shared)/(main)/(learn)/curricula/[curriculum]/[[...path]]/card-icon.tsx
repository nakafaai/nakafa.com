import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { readCurriculumRouteVisualIdentity } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";

const curriculumIconMarkVariants = cva("", {
  variants: {
    shape: {
      dot: "size-4 rounded-lg",
      full: "h-1 w-full rounded-full",
      medium: "h-1 w-2/3 rounded-full",
      short: "h-1 w-6 rounded-full",
    },
    tone: {
      amber: "bg-amber-500/20 dark:bg-amber-400/20",
      cyan: "bg-cyan-500/20 dark:bg-cyan-400/20",
      emerald: "bg-emerald-500/20 dark:bg-emerald-400/20",
      fuchsia: "bg-fuchsia-500/20 dark:bg-fuchsia-400/20",
      indigo: "bg-indigo-500/20 dark:bg-indigo-400/20",
      sky: "bg-sky-500/20 dark:bg-sky-400/20",
      violet: "bg-violet-500/20 dark:bg-violet-400/20",
    },
  },
});

const curriculumIconBadgeVariants = cva(
  "absolute flex items-center justify-center rounded-full border-2 border-card text-white shadow-xs transition-all ease-out group-hover:scale-110",
  {
    variants: {
      size: {
        large:
          "-bottom-2 -left-2 size-9 group-hover:-translate-x-1 group-hover:translate-y-1",
        small:
          "top-2 -right-2 size-6 group-hover:translate-x-1 group-hover:-translate-y-1",
      },
      tone: {
        amber: "bg-amber-500 dark:bg-amber-600",
        cyan: "bg-cyan-500 dark:bg-cyan-600",
        emerald: "bg-emerald-500 dark:bg-emerald-600",
        fuchsia: "bg-fuchsia-500 dark:bg-fuchsia-600",
        indigo: "bg-indigo-500 dark:bg-indigo-600",
        sky: "bg-sky-500 dark:bg-sky-600",
        violet: "bg-violet-500 dark:bg-violet-600",
      },
    },
  }
);

/** Renders root cards with the historical subject-page mini-card illustration. */
export function CurriculumRouteCardIcon({
  route,
}: {
  readonly route: PublicCurriculumRoute;
}) {
  const {
    iconPair: [PrimaryIcon, SecondaryIcon],
    tone,
  } = readCurriculumRouteVisualIdentity(route);

  return (
    <div className="relative flex h-18 w-20 items-center justify-center">
      <div className="relative flex h-14 w-16 flex-col gap-1.5 rounded-md border bg-card p-2.5 shadow-xs transition-all ease-out group-hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <div className={curriculumIconMarkVariants({ shape: "dot", tone })} />
          <div
            className={curriculumIconMarkVariants({ shape: "short", tone })}
          />
        </div>
        <div className={curriculumIconMarkVariants({ shape: "full", tone })} />
        <div
          className={curriculumIconMarkVariants({ shape: "medium", tone })}
        />

        <div className={curriculumIconBadgeVariants({ size: "small", tone })}>
          <HugeIcons className="size-3.5" icon={SecondaryIcon} />
        </div>

        <div className={curriculumIconBadgeVariants({ size: "large", tone })}>
          <HugeIcons className="size-4.5" icon={PrimaryIcon} />
        </div>
      </div>
    </div>
  );
}
