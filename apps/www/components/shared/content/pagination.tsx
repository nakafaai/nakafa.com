import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ContentPagination } from "@repo/contents/content";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { useTranslations } from "next-intl";

interface Props {
  className?: string;
  pagination: ContentPagination;
}

/**
 * Links one neighbouring page, or keeps its column without a link when there
 * is none.
 *
 * A reader who reaches the pagination is likely to open the next page, and a
 * phone gives no hover to prefetch on, so the link prefetches the page's own
 * cached content as it nears the viewport, not only the route's App Shell.
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
}: {
  href: string;
  title: string;
  label: string;
  icon: IconSvgElement;
  className?: string;
  iconPosition?: "left" | "right";
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
    <NavigationLink
      className={itemClassName}
      href={href}
      prefetch={true}
      title={title}
    >
      {content}
    </NavigationLink>
  );
}

export function PaginationContent({ pagination, className }: Props) {
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
          title={pagination.next.title}
        />
      </div>
    </nav>
  );
}
