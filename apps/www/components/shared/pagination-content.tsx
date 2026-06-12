import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ContentPagination } from "@repo/contents/_types/content";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import NavigationLink from "@repo/design-system/components/navigation/link";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Pagination,
  PaginationItem,
  PaginationContent as PaginationList,
} from "@repo/design-system/components/ui/pagination";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

interface Props {
  className?: string;
  pagination: ContentPagination;
}

/**
 * Renders one content-navigation action as a native COSS Button.
 *
 * The link keeps COSS Button chrome and uses a small two-line domain label so
 * adjacent lesson navigation remains readable without falling back to the old
 * title-tooltip behavior.
 */
function PaginationButton({
  href,
  title,
  label,
  icon,
  iconPosition = "right",
}: {
  href: string;
  title: string;
  label: string;
  icon: IconSvgElement;
  iconPosition?: "left" | "right";
}) {
  if (!href) {
    return null;
  }

  const isNext = iconPosition === "right";

  return (
    <Button
      className={cn(
        "h-auto w-full min-w-0 flex-col items-start whitespace-normal py-3 sm:h-auto",
        isNext ? "items-end text-right" : "items-start text-left"
      )}
      render={
        <NavigationLink aria-label={`${label}: ${title}`} href={href}>
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            {iconPosition === "left" && (
              <HugeIcons className="size-4" icon={icon} />
            )}
            <span>{label}</span>
            {iconPosition === "right" && (
              <HugeIcons className="size-4" icon={icon} />
            )}
          </span>
          <span className="line-clamp-2 min-w-0 text-foreground">{title}</span>
        </NavigationLink>
      }
      variant="outline"
    />
  );
}

export function PaginationContent({ pagination, className }: Props) {
  const t = useTranslations("Common");

  return (
    <Pagination
      aria-label="Pagination navigation"
      className={cn("mt-10 pt-10", className)}
    >
      <PaginationList className="w-full max-w-3xl justify-between gap-6 px-6">
        <PaginationItem className="min-w-0 flex-1">
          <PaginationButton
            href={pagination.prev.href}
            icon={ArrowLeft02Icon}
            iconPosition="left"
            label={t("previous")}
            title={pagination.prev.title}
          />
        </PaginationItem>

        <PaginationItem className="min-w-0 flex-1">
          <PaginationButton
            href={pagination.next.href}
            icon={ArrowRight02Icon}
            iconPosition="right"
            label={t("next")}
            title={pagination.next.title}
          />
        </PaginationItem>
      </PaginationList>
    </Pagination>
  );
}
