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

interface PaginationButtonProps {
  className: string;
  href: string;
  icon: IconSvgElement;
  iconPosition: "left" | "right";
  label: string;
  title: string;
}

const paginationButtonClassName =
  "group flex h-auto flex-col whitespace-normal py-3 shadow-xs";

/**
 * Links one neighbouring page, or keeps its column empty when there is none.
 *
 * A reader who reaches the pagination is likely to open the next page, so the
 * link prefetches that page's own content as soon as it nears the viewport,
 * not only the route's shared App Shell.
 */
function PaginationButton({
  className,
  href,
  icon,
  iconPosition,
  label,
  title,
}: PaginationButtonProps) {
  if (!href) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          buttonVariants({ variant: "outline" }),
          paginationButtonClassName,
          "pointer-events-none hidden opacity-50 sm:flex",
          className
        )}
      >
        <PaginationButtonLabel
          icon={icon}
          iconPosition={iconPosition}
          label={label}
          title={title}
        />
      </div>
    );
  }

  return (
    <NavigationLink
      className={cn(
        buttonVariants({ variant: "outline" }),
        paginationButtonClassName,
        className
      )}
      href={href}
      prefetch={true}
      title={title}
    >
      <PaginationButtonLabel
        icon={icon}
        iconPosition={iconPosition}
        label={label}
        title={title}
      />
    </NavigationLink>
  );
}

/** Renders the direction label above the neighbouring page's title. */
function PaginationButtonLabel({
  icon,
  iconPosition,
  label,
  title,
}: Omit<PaginationButtonProps, "className" | "href">) {
  return (
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
}

export function PaginationContent({ pagination, className }: Props) {
  const t = useTranslations("Common");

  return (
    <nav
      aria-label="Pagination navigation"
      className={cn("mt-10 pt-10", className)}
    >
      <div className="mx-auto grid max-w-3xl gap-6 px-6 sm:grid-cols-2">
        <PaginationButton
          className="items-start"
          href={pagination.prev.href}
          icon={ArrowLeft02Icon}
          iconPosition="left"
          label={t("previous")}
          title={pagination.prev.title}
        />

        <PaginationButton
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
