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
import { useEffect, useState } from "react";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";

/**
 * Renders folded breadcrumb items inside an ellipsis menu. The menu keeps its size, so
 * a long current title truncates instead of squeezing the button under the separator.
 * It closes when an item is chosen and when its page is hidden: Next.js keeps a page it
 * leaves in the document and shows it again on Back, and a menu still open there would
 * cover that page with its modal backdrop and take the next tap.
 */
export function BreadcrumbMenu({
  className,
  items,
  menuLabel,
}: {
  className: string;
  items: readonly BreadcrumbHeaderItem[];
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  // React runs this cleanup when Next.js hides the page, not only when it unmounts it.
  useEffect(() => () => setOpen(false), []);
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
                key={`${item.label}:${item.href ?? "current"}`}
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

  if (!item.href) {
    return <DropdownMenuItem render={<span>{label}</span>} />;
  }

  return (
    <DropdownMenuItem
      onClick={onChoose}
      render={<BreadcrumbAnchor href={item.href}>{label}</BreadcrumbAnchor>}
    />
  );
}
