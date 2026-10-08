import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ContentPagination } from "@repo/contents/content";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { useTranslations } from "next-intl";

interface Props {
  className?: string;
  pagination: ContentPagination;
  /**
   * Whether the Next link prefetches its page as the link nears the viewport.
   * A page that cannot name its final destination yet turns it off, so only
   * that destination is prefetched.
   */
  prefetchNext?: boolean;
}

/**
 * Links one neighbouring page, or keeps its column without a link when there
 * is none.
 *
 * A link with `prefetch` loads the page's own cached content as it nears the
 * viewport, not only the route's App Shell, which costs one server render per
 * link. Without it the link loads that content once the reader hovers,
 * focuses, or touches it.
 *
 * https://nextjs.org/docs/app/guides/optimizing-prefetching
 */
function PaginationItem({
  href,
  title,
  label,
  icon,
  className,
  iconPosition = "right",
  prefetch = false,
}: {
  href: string;
  title: string;
  label: string;
  icon: IconSvgElement;
  className?: string;
  iconPosition?: "left" | "right";
  prefetch?: boolean;
}) {
  const itemClassName = cn(
    buttonVariants({ variant: "outline" }),
    "group flex h-auto flex-col whitespace-normal py-3 shadow-xs",
    className
  );
  const content = (
    <>
      <div className="flex items-center gap-2 font-normal text-muted-foreground text-sm transition-colors group-hover:text-accent-foreground">
        {iconPosition === "left" && (
          <HugeIcons className="size-4 shrink-0" icon={icon} />
        )}
        {label}
        {iconPosition === "right" && (
          <HugeIcons className="size-4 shrink-0" icon={icon} />
        )}
      </div>
      <p
        className={cn(
          "w-full text-foreground transition-colors group-hover:text-accent-foreground",
          iconPosition === "right" ? "text-right" : ""
        )}
      >
        {title}
      </p>
    </>
  );

  if (!href) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          itemClassName,
          "pointer-events-none hidden opacity-50 sm:flex"
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <IntentLink
      className={itemClassName}
      href={href}
      intentActive={prefetch}
      title={title}
    >
      {content}
    </IntentLink>
  );
}

/**
 * Links the previous and next page. A reader who reaches the end of a page is
 * likely to continue, and a phone gives no hover to prefetch on, so the Next
 * link prefetches its page in view. Previous waits for intent, which spares a
 * reader who only moves forward the second server render.
 */
export function PaginationContent({
  pagination,
  className,
  prefetchNext = true,
}: Props) {
  const t = useTranslations("Common");

  return (
    <nav
      aria-label="Pagination navigation"
      className={cn("mt-10 pt-10", className)}
    >
      <div className="mx-auto grid max-w-3xl gap-6 px-6 sm:grid-cols-2">
        <PaginationItem
          className="items-start"
          href={pagination.prev.href}
          icon={ArrowLeft02Icon}
          iconPosition="left"
          label={t("previous")}
          title={pagination.prev.title}
        />

        <PaginationItem
          className="items-end"
          href={pagination.next.href}
          icon={ArrowRight02Icon}
          iconPosition="right"
          label={t("next")}
          prefetch={prefetchNext}
          title={pagination.next.title}
        />
      </div>
    </nav>
  );
}
