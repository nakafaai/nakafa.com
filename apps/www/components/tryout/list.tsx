import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import {
  TryoutStatus,
  type TryoutStatusValue,
} from "@/components/tryout/status";

type TryoutListRowVisual =
  | Readonly<{
      icon: IconSvgElement;
      iconKey: string;
      kind: "icon";
    }>
  | Readonly<{
      keyString: string;
      kind: "gradient";
    }>;

export type TryoutListRow = Readonly<{
  current?: boolean;
  description?: string;
  href: string;
  key: string;
  meta?: ReactNode;
  status?: TryoutStatusValue;
  title: string;
  visual: TryoutListRowVisual;
}>;

/** Renders the established divided try-out row list with gradient icons. */
export function TryoutList({
  emptyLabel,
  rows,
}: {
  emptyLabel: string;
  rows: readonly TryoutListRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="px-5 py-4 text-muted-foreground text-sm">
          {emptyLabel}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="grid divide-y">
        {rows.map((row) => (
          <TryoutRow key={row.key} row={row} />
        ))}
      </div>
    </section>
  );
}

/** Renders one production try-out list row. */
function TryoutRow({ row }: { row: TryoutListRow }) {
  return (
    <NavigationLink
      className="group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
      href={row.href}
      prefetch={false}
    >
      <div className="grid w-full gap-4">
        <div className="flex flex-1 items-start gap-3">
          <TryoutRowVisual visual={row.visual} />

          <div className="-mt-1 flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3>{row.title}</h3>
              {row.status ? <TryoutStatus status={row.status} /> : null}
            </div>
            {row.meta ? (
              <div className="flex flex-wrap items-center gap-2">
                {row.meta}
              </div>
            ) : null}
            {row.description ? (
              <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground">
                {row.description}
              </span>
            ) : null}
          </div>

          <HugeIcons
            className={cn(
              "size-4 shrink-0 opacity-0 transition-opacity ease-out",
              "group-hover:opacity-100",
              row.current && "opacity-100"
            )}
            icon={ArrowRight02Icon}
          />
        </div>
      </div>
    </NavigationLink>
  );
}

/** Renders the configured row visual without branching at call sites. */
function TryoutRowVisual({ visual }: { visual: TryoutListRowVisual }) {
  const keyString = visual.kind === "icon" ? visual.iconKey : visual.keyString;

  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
      <GradientBlock
        className="absolute inset-0"
        colorScheme="vibrant"
        intensity="medium"
        keyString={keyString}
      />
      {visual.kind === "icon" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <HugeIcons
            className="size-4 text-background drop-shadow-md"
            icon={visual.icon}
          />
        </div>
      ) : null}
    </div>
  );
}
