import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbMenu } from "@/components/shared/breadcrumb/menu";
import type { LinkTarget } from "@/lib/routing/link";

/**
 * Builds one segment of a breadcrumb path. A segment without a target is the
 * current page. Its type is the parameter of this builder, so every segment has
 * the one shape the breadcrumb renders.
 */
function breadcrumbItem(item: {
  readonly label: string;
  /** BCP 47 language of the label when it differs from the page. */
  readonly language?: string | undefined;
  readonly menuLabel?: string | undefined;
  readonly target?: LinkTarget | undefined;
}) {
  return item;
}

export type BreadcrumbHeaderItem = ReturnType<typeof breadcrumbItem>;

/** Props of one sticky, bounded breadcrumb header. */
interface BreadcrumbHeaderProps {
  /** Complete render value for one sticky, bounded breadcrumb header. */
  value: {
    action?: ReactNode;
    home: LinkTarget;
    homeLabel: string;
    items: readonly BreadcrumbHeaderItem[];
    menuLabel: string;
    title: string;
  };
}

type BreadcrumbHeaderValue = BreadcrumbHeaderProps["value"];

/**
 * Renders at most Home and the two nearest path items, with the action on the same
 * row at every width: the header is one row, so an action stays compact on a phone.
 */
export function BreadcrumbHeader({ value }: BreadcrumbHeaderProps) {
  const { action, home, homeLabel, items, menuLabel, title } = value;
  return (
    <BreadcrumbHeaderFrame contentClassName="flex-nowrap">
      <h1 className="sr-only">{title}</h1>
      <BreadcrumbHeaderPath
        home={home}
        homeLabel={homeLabel}
        items={Arr.map(items, (item, index) =>
          index === items.length - 1 ? { ...item, target: undefined } : item
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
  home,
  homeLabel,
  items,
  menuLabel,
  visibleItemCount = 2,
}: Pick<BreadcrumbHeaderValue, "home" | "homeLabel" | "items" | "menuLabel"> & {
  children?: ReactNode;
  visibleItemCount?: 1 | 2;
}) {
  const tCommon = useTranslations("Common");
  const hiddenItems = Arr.dropRight(items, visibleItemCount);
  const visibleItems = Arr.takeRight(items, visibleItemCount);
  const foldsOnPhone = items.length > 1;
  return (
    <Breadcrumb aria-label={tCommon("breadcrumb")} className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {foldsOnPhone ? (
          <BreadcrumbMenu
            className="sm:hidden"
            items={[
              { label: homeLabel, target: home },
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
              <BreadcrumbAnchor target={home}>{homeLabel}</BreadcrumbAnchor>
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
            key={`${item.label}:${item.target === undefined ? "current" : "link"}`}
          />
        ))}
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * A path folded whole into its ellipsis menu, as Google Drive shows it on a phone: Home
 * and every item go into the menu, and the page names itself beside it. A header whose
 * own title is the current page, such as a surah's, shows this on a phone so the title
 * shares the row.
 */
export function BreadcrumbHeaderFold({
  className,
  home,
  homeLabel,
  items,
  menuLabel,
}: Pick<BreadcrumbHeaderValue, "home" | "homeLabel" | "items" | "menuLabel"> & {
  className: string;
}) {
  const tCommon = useTranslations("Common");

  return (
    <Breadcrumb
      aria-label={tCommon("breadcrumb")}
      className={cn("shrink-0", className)}
    >
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbMenu
          className=""
          items={[{ label: homeLabel, target: home }, ...items]}
          menuLabel={menuLabel}
        />
      </BreadcrumbList>
    </Breadcrumb>
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
  if (item.target === undefined) {
    return (
      <>
        <BreadcrumbSeparator className={cn("shrink-0", className)} />
        <BreadcrumbItem className={cn("min-w-0", className)} dir="auto">
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
      <BreadcrumbItem className={cn("min-w-0", className)} dir="auto">
        <BreadcrumbLink
          className="truncate"
          render={
            <BreadcrumbAnchor target={item.target}>
              {item.label}
            </BreadcrumbAnchor>
          }
        />
      </BreadcrumbItem>
    </>
  );
}
