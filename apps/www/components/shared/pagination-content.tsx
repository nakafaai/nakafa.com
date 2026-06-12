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
 * The title is kept in a single truncating row because Button owns fixed
 * control height and whitespace. Card-like multi-line previews should use a
 * separate Frame/Card composition, not override button chrome.
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
        "w-full min-w-0",
        isNext ? "justify-end text-right" : "justify-start"
      )}
      render={
        <NavigationLink aria-label={`${label}: ${title}`} href={href}>
          {iconPosition === "left" && <HugeIcons icon={icon} />}
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">{label}</span>
            <span className="hidden sm:inline">
              <span aria-hidden>: </span>
              <span>{title}</span>
            </span>
          </span>
          {iconPosition === "right" && <HugeIcons icon={icon} />}
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
