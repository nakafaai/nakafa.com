import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import {
  type getPrimaryNavigationItems,
  getPrimaryNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { TargetLink } from "@/lib/routing/link";

type Item = ReturnType<typeof getPrimaryNavigationItems>[number];

/** The one action of a home section: See all, which leads where the sidebar's entry of the same name leads. */
export function SectionMore({ item }: { item: Item }) {
  const t = useTranslations("Home");
  return (
    <TargetLink
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      target={getPrimaryNavigationTarget(item)}
    >
      {t("more")}
      <HugeIcons icon={ArrowRight01Icon} />
    </TargetLink>
  );
}

/**
 * The row of a section that has nothing to pick up again yet: the place the
 * section leads to, with the sidebar's own icon and name for it and one
 * sentence on what waits there. It stands on the same ruler as a lesson row.
 */
export function SectionDoor({
  item,
  sentence,
}: {
  item: Item;
  sentence: string;
}) {
  const t = useTranslations(item.labelNamespace);
  return (
    <TargetLink
      className="group hover:bg-accent hover:text-accent-foreground flex items-start gap-3 p-4 transition-colors ease-out"
      target={getPrimaryNavigationTarget(item)}
    >
      <Tile seed={item.id}>
        <TileIcon icon={item.icon} />
      </Tile>
      <div className="-mt-1 flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="truncate">{t(item.labelKey)}</h3>
        <span className="text-muted-foreground group-hover:text-accent-foreground truncate text-sm">
          {sentence}
        </span>
      </div>
    </TargetLink>
  );
}
