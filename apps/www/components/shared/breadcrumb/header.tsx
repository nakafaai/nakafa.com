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

/** Bounded path navigation with linked parents and one collapsed middle group. */
export function BreadcrumbHeaderPath({
  children,
  className,
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
  className?: string;
  visibleItemCount?: 1 | 2;
}) {
  const hiddenItems = Arr.dropRight(items, visibleItemCount);
  const visibleItems = Arr.takeRight(items, visibleItemCount);
  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink
            render={
              <BreadcrumbAnchor href={homeHref}>{homeLabel}</BreadcrumbAnchor>
            }
          />
        </BreadcrumbItem>
        {hiddenItems.length > 0 && (
          <BreadcrumbMenu items={hiddenItems} menuLabel={menuLabel} />
        )}
        {Arr.map(visibleItems, (item) => (
          <BreadcrumbHeaderSegment
            item={item}
            key={`${item.label}:${item.href ?? "current"}`}
          />
        ))}
        {children}
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
      render={<BreadcrumbAnchor href={item.href}>{label}</BreadcrumbAnchor>}
    />
  );
}

/** Renders one visible current or linked breadcrumb segment. */
export function BreadcrumbHeaderSegment({
  item,
}: {
  item: BreadcrumbHeaderItem;
}) {
  if (!item.href) {
    return (
      <>
        <BreadcrumbSeparator className="shrink-0" />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate" lang={item.language}>
            {item.label}
          </BreadcrumbPage>
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
          render={
            <BreadcrumbAnchor href={item.href}>{item.label}</BreadcrumbAnchor>
          }
        />
      </BreadcrumbItem>
    </>
  );
}
