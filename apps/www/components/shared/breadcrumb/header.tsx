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
import { cn } from "cn";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";

const BreadcrumbHeaderItemSchema = Schema.Struct({
  href: Schema.optional(Schema.String),
  label: Schema.String,
  /** BCP 47 language of the label when it differs from the page. */
  language: Schema.optionalKey(Schema.String),
  menuLabel: Schema.optionalKey(Schema.String),
});

export type BreadcrumbHeaderItem = typeof BreadcrumbHeaderItemSchema.Type;

/** Props of one sticky, bounded breadcrumb header. */
interface BreadcrumbHeaderProps {
  /** Complete render value for one sticky, bounded breadcrumb header. */
  value: {
    action?: ReactNode;
    homeHref: string;
    homeLabel: string;
    items: readonly BreadcrumbHeaderItem[];
    menuLabel: string;
    title: string;
  };
}

type BreadcrumbHeaderValue = BreadcrumbHeaderProps["value"];

/**
 * Renders at most Home and the two nearest path items. The action shares the
 * path's row, and an action that takes the full width, such as a selector on a
 * phone, wraps under the path.
 */
export function BreadcrumbHeader({ value }: BreadcrumbHeaderProps) {
  const { action, homeHref, homeLabel, items, menuLabel, title } = value;
  return (
    <BreadcrumbHeaderFrame contentClassName="flex-wrap sm:flex-nowrap sm:py-0">
      <h1 className="sr-only">{title}</h1>
      <BreadcrumbHeaderPath
        homeHref={homeHref}
        homeLabel={homeLabel}
        items={Arr.map(items, (item, index) =>
          index === items.length - 1 ? { ...item, href: undefined } : item
        )}
        menuLabel={menuLabel}
      />
      {action}
    </BreadcrumbHeaderFrame>
  );
}

/**
 * Bounded path navigation with linked parents and one collapsed group, as Google Drive
 * and shadcn's responsive breadcrumb fold a long path. From the small breakpoint up it
 * shows Home, a menu of the middle items, and the nearest `visibleItemCount` items. On a
 * phone a path of two items or more keeps only its last item beside one menu that holds
 * Home and every item before it, so the page's name stays readable next to the page's
 * actions.
 */
export function BreadcrumbHeaderPath({
  children,
  homeHref,
  homeLabel,
  items,
  menuLabel,
  visibleItemCount = 2,
}: Pick<
  BreadcrumbHeaderValue,
  "homeHref" | "homeLabel" | "items" | "menuLabel"
> & {
  children?: ReactNode;
  visibleItemCount?: 1 | 2;
}) {
  const hiddenItems = Arr.dropRight(items, visibleItemCount);
  const visibleItems = Arr.takeRight(items, visibleItemCount);
  const foldsOnPhone = items.length > 1;
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {foldsOnPhone ? (
          <BreadcrumbMenu
            className="sm:hidden"
            items={[
              { href: homeHref, label: homeLabel },
              ...Arr.dropRight(items, 1),
            ]}
            menuLabel={menuLabel}
          />
        ) : null}
        <BreadcrumbItem
          className={cn("shrink-0", foldsOnPhone && "max-sm:hidden")}
        >
          <BreadcrumbLink
            render={
              <BreadcrumbAnchor href={homeHref}>{homeLabel}</BreadcrumbAnchor>
            }
          />
        </BreadcrumbItem>
        {hiddenItems.length > 0 && (
          <>
            <BreadcrumbSeparator className="shrink-0 max-sm:hidden" />
            <BreadcrumbMenu
              className="max-sm:hidden"
              items={hiddenItems}
              menuLabel={menuLabel}
            />
          </>
        )}
        {Arr.map(visibleItems, (item, index) => (
          <BreadcrumbHeaderSegment
            className={cn(
              foldsOnPhone && index < visibleItems.length - 1 && "max-sm:hidden"
            )}
            item={item}
            key={`${item.label}:${item.href ?? "current"}`}
          />
        ))}
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Renders folded breadcrumb items inside an ellipsis menu. */
function BreadcrumbMenu({
  className,
  items,
  menuLabel,
}: {
  className: string;
  items: readonly BreadcrumbHeaderItem[];
  menuLabel: string;
}) {
  return (
    <BreadcrumbItem className={cn("min-w-0", className)}>
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
            {Arr.map(items, (item) => (
              <BreadcrumbMenuItem
                item={item}
                key={`${item.label}:${item.href ?? "current"}`}
              />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </BreadcrumbItem>
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
      render={<BreadcrumbAnchor href={item.href}>{label}</BreadcrumbAnchor>}
    />
  );
}

/**
 * Renders one visible current or linked breadcrumb segment, with the separator before
 * it. A `className` applies to both, so a path can hide a segment whole.
 */
export function BreadcrumbHeaderSegment({
  className,
  item,
}: {
  className?: string;
  item: BreadcrumbHeaderItem;
}) {
  if (!item.href) {
    return (
      <>
        <BreadcrumbSeparator className={cn("shrink-0", className)} />
        <BreadcrumbItem className={cn("min-w-0", className)}>
          <BreadcrumbPage className="truncate" lang={item.language}>
            {item.label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSeparator className={cn("shrink-0", className)} />
      <BreadcrumbItem className={cn("min-w-0", className)}>
        <BreadcrumbLink
          className="truncate"
          render={
            <BreadcrumbAnchor href={item.href}>{item.label}</BreadcrumbAnchor>
          }
        />
      </BreadcrumbItem>
    </>
  );
}
