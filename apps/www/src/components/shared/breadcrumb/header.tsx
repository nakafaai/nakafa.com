import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { BreadcrumbMenu } from "@/components/shared/breadcrumb/menu";
import { Link, type LinkTarget } from "@/lib/routing/link";

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
    title: string;
  };
}

type BreadcrumbHeaderValue = BreadcrumbHeaderProps["value"];

/**
 * Renders at most Home and the two nearest path items, with the action on the same
 * row at every width: the header is one row, so an action stays compact on a phone.
 */
export function BreadcrumbHeader({ value }: BreadcrumbHeaderProps) {
  const { action, home, homeLabel, items, title } = value;
  return (
    <BreadcrumbHeaderFrame contentClassName="flex-nowrap">
      <h1 className="sr-only">{title}</h1>
      <BreadcrumbHeaderPath
        home={home}
        homeLabel={homeLabel}
        items={Arr.map(items, (item, index) =>
          index === items.length - 1 ? { ...item, target: undefined } : item
        )}
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
 * Home and every item before it, and a path of one item keeps that item alone, so the
 * page's name stays whole next to the page's actions. A path that `unfolds` shows every item in a frame row of 42rem or wider, whose
 * `@container` the header sets, and only its last item truncates. CSS alone folds it, so
 * the first paint already has its final shape.
 */
export function BreadcrumbHeaderPath({
  home,
  homeLabel,
  items,
  unfolds = false,
  visibleItemCount = 2,
}: Pick<BreadcrumbHeaderValue, "home" | "homeLabel" | "items"> & {
  unfolds?: boolean;
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
          />
        ) : null}
        <BreadcrumbItem
          className={cn("shrink-0", items.length > 0 && "max-sm:hidden")}
        >
          <BreadcrumbLink
            render={
              <BreadcrumbAnchor target={home}>{homeLabel}</BreadcrumbAnchor>
            }
          />
        </BreadcrumbItem>
        {hiddenItems.length > 0 && (
          <>
            <BreadcrumbSeparator
              className={cn("shrink-0 max-sm:hidden", unfolds && "@2xl:hidden")}
            />
            <BreadcrumbMenu
              className={cn("max-sm:hidden", unfolds && "@2xl:hidden")}
              items={hiddenItems}
            />
          </>
        )}
        {unfolds &&
          Arr.map(hiddenItems, (item) => (
            <BreadcrumbHeaderSegment
              className="hidden shrink-0 @2xl:inline-flex"
              item={item}
              key={`${item.label}:unfolded`}
            />
          ))}
        {Arr.map(visibleItems, (item, index) => (
          <BreadcrumbHeaderSegment
            className={cn(
              foldsOnPhone &&
                index < visibleItems.length - 1 &&
                "max-sm:hidden",
              unfolds && index < visibleItems.length - 1 && "@2xl:shrink-0"
            )}
            item={item}
            key={`${item.label}:${item.target === undefined ? "current" : "link"}`}
            separatorClassName={cn(items.length === 1 && "max-sm:hidden")}
          />
        ))}
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
}: Pick<BreadcrumbHeaderValue, "home" | "homeLabel" | "items"> & {
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
        />
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Renders one visible breadcrumb segment, with the separator before it. Every segment
 * is a link: the current page's links to itself and keeps its search, and it reads as the
 * current page. A `className` applies to both, so a path can hide a segment whole.
 */
function BreadcrumbHeaderSegment({
  className,
  item,
  separatorClassName,
}: {
  className?: string;
  item: BreadcrumbHeaderItem;
  /** Hides the separator alone, as a phone does before the one item of a path. */
  separatorClassName?: string;
}) {
  if (item.target === undefined) {
    return (
      <>
        <BreadcrumbSeparator
          className={cn("shrink-0", className, separatorClassName)}
        />
        <BreadcrumbItem className={cn("min-w-0", className)} dir="auto">
          <BreadcrumbLink
            aria-current="page"
            className="text-foreground truncate"
            lang={item.language}
            render={<Link search={true} to="." />}
          >
            {item.label}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSeparator
        className={cn("shrink-0", className, separatorClassName)}
      />
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
