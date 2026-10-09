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
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
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
    homeLabel: string;
    items: readonly BreadcrumbHeaderItem[];
    menuLabel: string;
    title: string;
  };
}

type BreadcrumbHeaderValue = BreadcrumbHeaderProps["value"];

/** Renders at most Home and the two nearest path items. */
export function BreadcrumbHeader({ value }: BreadcrumbHeaderProps) {
  const { action, homeLabel, items, menuLabel, title } = value;
  return (
    <BreadcrumbHeaderFrame contentClassName="flex-col items-stretch justify-center sm:flex-row sm:items-center sm:justify-between sm:py-0">
      <h1 className="sr-only">{title}</h1>
      <BreadcrumbHeaderPath
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
  homeLabel,
  items,
  menuLabel,
  visibleItemCount = 2,
}: Pick<BreadcrumbHeaderValue, "homeLabel" | "items" | "menuLabel"> & {
  children?: ReactNode;
  visibleItemCount?: 1 | 2;
}) {
  const hiddenItems = items.slice(0, -visibleItemCount);
  const visibleItems = items.slice(-visibleItemCount);
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
      render={<IntentLink href={item.href}>{label}</IntentLink>}
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
          render={<IntentLink href={item.href}>{item.label}</IntentLink>}
        />
      </BreadcrumbItem>
    </>
  );
}
