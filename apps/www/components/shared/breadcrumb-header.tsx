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
  openMenuLabel: string;
  title: string;
}

/** Renders at most Home and the two nearest path items. */
export function BreadcrumbHeader({ value }: { value: BreadcrumbHeaderValue }) {
  const { action, homeLabel, items, menuLabel, openMenuLabel, title } = value;
  const hiddenItems = items.slice(0, -VISIBLE_PATH_ITEM_COUNT);
  const visibleItems = items.slice(-VISIBLE_PATH_ITEM_COUNT);

  return (
    <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <h1 className="sr-only">{title}</h1>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<IntentLink href="/home">{homeLabel}</IntentLink>}
              />
            </BreadcrumbItem>
            <HiddenBreadcrumbs
              items={hiddenItems}
              menuLabel={menuLabel}
              openMenuLabel={openMenuLabel}
            />
            {visibleItems.map((item, index) => (
              <BreadcrumbSegment
                isCurrent={index === visibleItems.length - 1}
                item={item}
                key={`${item.label}:${item.href ?? "current"}`}
              />
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {action}
      </div>
    </header>
  );
}

/** Renders the collapsed breadcrumb group only when the path exceeds its cap. */
function HiddenBreadcrumbs({
  items,
  menuLabel,
  openMenuLabel,
}: {
  items: readonly BreadcrumbHeaderItem[];
  menuLabel: string;
  openMenuLabel: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <BreadcrumbMenu
      items={items}
      menuLabel={menuLabel}
      openMenuLabel={openMenuLabel}
    />
  );
}

/** Renders collapsed middle breadcrumb items inside an ellipsis menu. */
function BreadcrumbMenu({
  items,
  menuLabel,
  openMenuLabel,
}: {
  items: readonly BreadcrumbHeaderItem[];
  menuLabel: string;
  openMenuLabel: string;
}) {
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label={openMenuLabel}
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
function BreadcrumbSegment({
  isCurrent,
  item,
}: {
  isCurrent: boolean;
  item: BreadcrumbHeaderItem;
}) {
  if (isCurrent || !item.href) {
    return (
      <>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink
          render={<IntentLink href={item.href}>{item.label}</IntentLink>}
        />
      </BreadcrumbItem>
    </>
  );
}
