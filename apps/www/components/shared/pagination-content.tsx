import type { ContentPagination } from "@repo/contents/_types/content";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Props = {
  pagination: ContentPagination;
  className?: string;
};

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
  icon: ReactNode;
  className?: string;
  iconPosition?: "left" | "right";
}) {
  return (
    <NavigationLink
      className={cn(
        buttonVariants({ variant: "outline" }),
        "group flex h-auto flex-col whitespace-normal py-3 shadow-sm",
        !href && "pointer-events-none hidden opacity-50 sm:flex",
        className,
      )}
      href={href}
      title={title}
    >
      <div className="flex items-center gap-2 font-normal text-muted-foreground text-sm transition-colors group-hover:text-accent-foreground">
        {iconPosition === "left" && icon}
        {label}
        {iconPosition === "right" && icon}
      </div>
      <p
        className={cn(
          "w-full font-medium text-foreground transition-colors group-hover:text-accent-foreground",
          iconPosition === "right" ? "text-right" : "",
        )}
      >
        {title}
      </p>
    </NavigationLink>
  );
}

export function PaginationContent({ pagination, className }: Props) {
  const t = useTranslations("Common");

  return (
    <div className={cn("mt-10 pt-10", className)}>
      <div className="mx-auto grid max-w-3xl gap-6 px-6 sm:grid-cols-2">
        <PaginationButton
          className="items-start"
          href={pagination.prev.href}
          icon={<ArrowLeftIcon className="size-4 shrink-0" />}
          iconPosition="left"
          label={t("previous")}
          title={pagination.prev.title}
        />

        <PaginationButton
          className="items-end"
          href={pagination.next.href}
          icon={<ArrowRightIcon className="size-4 shrink-0" />}
          iconPosition="right"
          label={t("next")}
          title={pagination.next.title}
        />
      </div>
    </div>
  );
}
