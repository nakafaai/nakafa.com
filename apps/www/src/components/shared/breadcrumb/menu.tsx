"use client";

import { Folder02Icon } from "@hugeicons/core-free-icons";
import {
  BreadcrumbEllipsis,
  BreadcrumbItem,
} from "@repo/design-system/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";

/**
 * Renders folded breadcrumb items inside an ellipsis menu. The menu keeps its size, so
 * a long current title truncates instead of squeezing the button under the separator.
 * It closes when an item is chosen. The router unmounts the page on navigation, which
 * takes an open menu with it.
 */
export function BreadcrumbMenu({
  className,
  items,
}: {
  className: string;
  items: readonly BreadcrumbHeaderItem[];
}) {
  const tCommon = useTranslations("Common");
  const menuLabel = tCommon("more");
  const [open, setOpen] = useState(false);
  return (
    <BreadcrumbItem className={cn("shrink-0", className)}>
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger
          render={
            <button
              aria-label={menuLabel}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex size-6 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
              type="button"
            >
              <BreadcrumbEllipsis />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{tCommon("menu-pages")}</DropdownMenuLabel>
            {Arr.map(items, (item) => (
              <BreadcrumbMenuItem
                item={item}
                key={`${item.label}:${item.target === undefined ? "current" : "link"}`}
                onChoose={() => setOpen(false)}
              />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
  );
}

/**
 * Renders one collapsed breadcrumb menu item, which closes its menu when chosen and carries its icon, as
 * every menu item does. A segment without a link is the page itself, which names itself beside the menu,
 * so the menu holds no row that cannot be pressed.
 */
function BreadcrumbMenuItem({
  item,
  onChoose,
}: {
  item: BreadcrumbHeaderItem;
  onChoose: () => void;
}) {
  const label = item.menuLabel ?? item.label;

  if (item.target === undefined) {
    return null;
  }

  return (
    <DropdownMenuItem
      onClick={onChoose}
      render={
        <BreadcrumbAnchor target={item.target}>
          <HugeIcons icon={Folder02Icon} />
          {label}
        </BreadcrumbAnchor>
      }
    />
  );
}
