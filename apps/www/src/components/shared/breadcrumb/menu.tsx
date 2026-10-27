"use client";

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
              className="flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
            >
              <BreadcrumbEllipsis />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
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

/** Renders one linked or inert collapsed breadcrumb menu item, which closes its menu when chosen. */
function BreadcrumbMenuItem({
  item,
  onChoose,
}: {
  item: BreadcrumbHeaderItem;
  onChoose: () => void;
}) {
  const label = item.menuLabel ?? item.label;

  if (item.target === undefined) {
    return <DropdownMenuItem render={<span>{label}</span>} />;
  }

  return (
    <DropdownMenuItem
      onClick={onChoose}
      render={<BreadcrumbAnchor target={item.target}>{label}</BreadcrumbAnchor>}
    />
  );
}
