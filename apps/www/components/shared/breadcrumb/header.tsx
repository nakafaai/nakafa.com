import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { ReactNode } from "react";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

const VISIBLE_PATH_ITEM_COUNT = 2;

export type BreadcrumbHeaderItem = Readonly<{
  href?: string;
  label: string;
  menuLabel?: string;
}>;

/** Complete render value for one sticky, bounded breadcrumb header. */
export interface BreadcrumbHeaderValue {
  action?: ReactNode;
  homeLabel: string;
  items: readonly BreadcrumbHeaderItem[];
  menuLabel: string;
  title: string;
}

/** Renders at most Home and the two nearest path items. */
export function BreadcrumbHeader({ value }: { value: BreadcrumbHeaderValue }) {
  const { action, homeLabel, items, menuLabel, title } = value;
  return (
    <BreadcrumbHeaderFrame contentClassName="flex-col items-stretch sm:flex-row sm:items-center sm:py-0">
      <h1 className="sr-only">{title}</h1>
      <BreadcrumbHeaderPath
        homeLabel={homeLabel}
        items={items.map((item, index) =>
          index === items.length - 1 ? { ...item, href: undefined } : item
        )}
        menuLabel={menuLabel}
      />
      {action}
    </BreadcrumbHeaderFrame>
  );
}

/** Bounded path navigation with linked parents and one collapsed middle group. */
export function BreadcrumbHeaderPath({
  homeLabel,
  items,
  menuLabel,
}: Pick<BreadcrumbHeaderValue, "homeLabel" | "items" | "menuLabel">) {
  const hiddenItems = items.slice(0, -VISIBLE_PATH_ITEM_COUNT);
  const visibleItems = items.slice(-VISIBLE_PATH_ITEM_COUNT);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink
            render={<IntentLink href="/home">{homeLabel}</IntentLink>}
          />
        </BreadcrumbItem>
        {hiddenItems.length > 0 && (
          <BreadcrumbMenu items={hiddenItems} menuLabel={menuLabel} />
        )}
        {visibleItems.map((item) => (
          <BreadcrumbSegment
            item={item}
            key={`${item.label}:${item.href ?? "current"}`}
          />
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Renders collapsed middle breadcrumb items inside an ellipsis menu. */
function BreadcrumbMenu({
  items,
  menuLabel,
}: {
  items: readonly BreadcrumbHeaderItem[];
  menuLabel: string;
}) {
  return (
    <>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <DropdownMenu>
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
              {items.map((item) => (
                <BreadcrumbMenuItem
                  item={item}
                  key={`${item.label}:${item.href ?? "current"}`}
                />
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
    </>
  );
}

/** Renders one linked or inert collapsed breadcrumb menu item. */
function BreadcrumbMenuItem({ item }: { item: BreadcrumbHeaderItem }) {
  const label = item.menuLabel ?? item.label;

  if (!item.href) {
    return <DropdownMenuItem render={<span>{label}</span>} />;
  }

  return (
    <DropdownMenuItem
      render={<IntentLink href={item.href}>{label}</IntentLink>}
    />
  );
}

/** Renders one visible current or linked breadcrumb segment. */
function BreadcrumbSegment({ item }: { item: BreadcrumbHeaderItem }) {
  if (!item.href) {
    return (
      <>
        <BreadcrumbSeparator className="shrink-0" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbLink
          className="truncate"
          render={<IntentLink href={item.href}>{item.label}</IntentLink>}
        />
      </BreadcrumbItem>
    </>
  );
}
