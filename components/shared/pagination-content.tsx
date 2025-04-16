import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContentPagination } from "@/types/content";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import NavigationLink from "../ui/navigation-link";

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
      href={href}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "group flex h-auto flex-col whitespace-normal py-3",
        !href && "pointer-events-none hidden opacity-50 sm:flex",
        className
      )}
    >
      <div className="flex items-center gap-2 font-normal text-muted-foreground text-sm transition-colors group-hover:text-accent-foreground">
        {iconPosition === "left" && icon}
        {label}
        {iconPosition === "right" && icon}
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
  );
}

export function PaginationContent({ pagination, className }: Props) {
  const t = useTranslations("Common");

  return (
    <div className={cn("mt-10 border-t pt-10", className)}>
      <div className="mx-auto grid max-w-3xl gap-6 px-4 sm:grid-cols-2">
        <PaginationButton
          href={pagination.prev.href}
          title={pagination.prev.title}
          label={t("previous")}
          icon={<ArrowLeftIcon className="size-4 shrink-0" />}
          className="items-start"
          iconPosition="left"
        />

        <PaginationButton
          href={pagination.next.href}
          title={pagination.next.title}
          label={t("next")}
          icon={<ArrowRightIcon className="size-4 shrink-0" />}
          className="items-end"
          iconPosition="right"
        />
      </div>
    </div>
  );
}
