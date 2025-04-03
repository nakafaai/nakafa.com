import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ContentPagination } from "@/types/content";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import NavigationLink from "../ui/navigation-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type Props = {
  pagination: ContentPagination;
  className?: string;
};

export function PaginationContent({ pagination, className }: Props) {
  const t = useTranslations("Common");

  return (
    <div
      className={cn("mt-10 flex items-center justify-between gap-4", className)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <NavigationLink
            href={pagination.prev.href}
            className={cn(
              buttonVariants({ variant: "outline" }),
              !pagination.prev.href && "pointer-events-none opacity-50"
            )}
          >
            <ChevronLeftIcon className="size-4 shrink-0" />
            {t("previous")}
          </NavigationLink>
        </TooltipTrigger>
        <TooltipContent hidden={!pagination.prev.href}>
          <p>{pagination.prev.title}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <NavigationLink
            href={pagination.next.href}
            className={cn(
              buttonVariants({ variant: "outline" }),
              !pagination.next.href && "pointer-events-none opacity-50"
            )}
          >
            {t("next")}
            <ChevronRightIcon className="size-4 shrink-0" />
          </NavigationLink>
        </TooltipTrigger>
        <TooltipContent hidden={!pagination.next.href}>
          <p>{pagination.next.title}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
