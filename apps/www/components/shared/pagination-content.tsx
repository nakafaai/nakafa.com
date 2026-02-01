import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ContentPagination } from "@repo/contents/_types/content";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

interface Props {
  pagination: ContentPagination;
  className?: string;
}

function PaginationButton({
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
  return (
    <Button
      className={cn(
        "group flex h-auto flex-col whitespace-normal py-3 shadow-xs",
        !href && "pointer-events-none hidden opacity-50 sm:flex",
        className
      )}
      nativeButton={false}
      render={
        <NavigationLink href={href} title={title}>
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
              "w-full font-medium text-foreground transition-colors group-hover:text-accent-foreground",
              iconPosition === "right" ? "text-right" : ""
            )}
          >
            {title}
          </p>
        </NavigationLink>
      }
      variant="outline"
    />
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
