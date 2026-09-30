import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { ReactNode } from "react";

/** Lists a card's page links as rows divided by rules. */
export function CardLinks({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>;
}

/**
 * One page link in a card: the row lights up on hover and shows an arrow
 * toward the page it opens. The last row reaches the card's bottom edge.
 * Rows prefetch on intent, since a card can list many pages.
 */
export function CardLink({
  children,
  href,
  title,
}: {
  children: ReactNode;
  href: string;
  title: string;
}) {
  return (
    <li className="group/list">
      <IntentLink
        className="group flex w-full scroll-mt-28 items-center gap-2 px-6 py-3 transition-colors ease-out hover:bg-accent hover:text-accent-foreground group-last/list:pb-6"
        href={href}
        title={title}
      >
        {children}
        <HugeIcons
          className="size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100"
          icon={ArrowRight02Icon}
        />
      </IntentLink>
    </li>
  );
}
