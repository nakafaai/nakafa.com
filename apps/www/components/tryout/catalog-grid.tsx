import { ArrowRight02Icon, BookOpen02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";
import { TryoutCatalogCard } from "@/components/tryout/catalog-card";

export interface TryoutCatalogGridItem {
  badge: string;
  ctaLabel: string;
  description?: string;
  href: string;
  meta?: ReactNode;
  title: string;
}

interface TryoutCatalogGridProps {
  emptyLabel: string;
  items: readonly TryoutCatalogGridItem[];
}

/** Renders a compact grid of country, exam, set, or section try-out rows. */
export function TryoutCatalogGrid({
  emptyLabel,
  items,
}: TryoutCatalogGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5 text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <TryoutCatalogCard
          action={
            <NavigationLink
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={item.href}
            >
              {item.ctaLabel}
              <HugeIcons className="size-4" icon={ArrowRight02Icon} />
            </NavigationLink>
          }
          activeCountLabel={item.badge}
          art={<HugeIcons className="size-10" icon={BookOpen02Icon} />}
          description={item.description ?? ""}
          key={item.href}
          title={item.title}
        >
          {item.meta ? (
            <div className="border-t px-5 py-3 text-muted-foreground text-sm">
              {item.meta}
            </div>
          ) : null}
        </TryoutCatalogCard>
      ))}
    </div>
  );
}
