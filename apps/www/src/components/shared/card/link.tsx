import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva, type VariantProps } from "class-variance-authority";
import { Option } from "effect";
import type { ReactNode } from "react";
import { type LinkTarget, TargetLink } from "@/lib/routing/link";
import { publicPathTarget } from "@/lib/routing/target";

/**
 * The frame of a row in a card's list: the row's padding, and the card's spacing on the list's first row when the
 * list opens the card and on its last row. A linked row also lights up on hover.
 */
const cardRow = cva(
  "group flex w-full items-center gap-2 px-6 py-3 in-[[data-slot=card]>ul:first-child]:group-first/list:pt-(--card-spacing) group-last/list:pb-(--card-spacing)",
  {
    variants: {
      linked: {
        false: "",
        true: "scroll-mt-28 transition-colors ease-out hover:bg-accent hover:text-accent-foreground",
      },
    },
  }
);

/**
 * The arrow at the end of a link's row. It shows on hover, which is the default, or always, for a row that has no
 * other text to say that it opens a page.
 */
const cardArrow = cva("size-4 shrink-0 transition-opacity ease-out", {
  defaultVariants: {
    arrow: "hover",
  },
  variants: {
    arrow: {
      always: "",
      hover: "opacity-0 group-hover:opacity-100",
    },
  },
});

/**
 * One page link of a card, addressed by a signed public path of the content. A
 * path that names no page renders no row.
 */
export function PublicPathCardLink({
  arrow,
  children,
  context,
  publicPath,
  title,
}: {
  arrow?: VariantProps<typeof cardArrow>["arrow"];
  children: ReactNode;
  context?: string | undefined;
  publicPath: string;
  title: string;
}) {
  const target = publicPathTarget(publicPath, context);
  if (Option.isNone(target)) {
    return null;
  }
  return (
    <CardLink arrow={arrow} target={target.value} title={title}>
      {children}
    </CardLink>
  );
}

/** Lists a card's page links as rows divided by rules. */
export function CardLinks({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>;
}

/**
 * One page link in a card: the row lights up on hover and shows an arrow
 * toward the page it opens. The last row takes the card's bottom spacing, so
 * its highlight reaches the bottom edge, and the first row takes the card's
 * top spacing when the list opens the card. Rows prefetch on intent, since a
 * card can list many pages.
 */
export function CardLink({
  arrow,
  children,
  target,
  title,
}: {
  /** When the arrow shows: on hover, which is the default, or always. */
  arrow?: VariantProps<typeof cardArrow>["arrow"];
  children: ReactNode;
  target: LinkTarget;
  title: string;
}) {
  const className = cardRow({ linked: true });
  const arrowIcon = (
    <HugeIcons className={cardArrow({ arrow })} icon={ArrowRight02Icon} />
  );
  return (
    <li className="group/list">
      <TargetLink className={className} target={target} title={title}>
        {children}
        {arrowIcon}
      </TargetLink>
    </li>
  );
}

/**
 * One row of a card's list that opens no page, such as a draft the server is still saving. It takes the frame of a
 * `CardLink` row, so it keeps the same height as the linked rows, including the card's bottom spacing on the last.
 */
export function CardRowText({ children }: { children: ReactNode }) {
  return (
    <li className="group/list">
      <div className={cardRow({ linked: false })}>{children}</div>
    </li>
  );
}
