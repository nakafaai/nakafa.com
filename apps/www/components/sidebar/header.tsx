import { buttonVariants } from "@repo/design-system/components/ui/button";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { IconBrandGithub, IconBrandYoutube } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { HeaderContainer } from "./header-container";
import { HeaderSearch } from "./header-search";

export function Header() {
  const t = useTranslations("Common");
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-6 sm:w-full">
          <SidebarTrigger className="size-8" variant="outline" />
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          <HeaderSearch />
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                aria-label={t("source-code")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-8 shrink-0"
                )}
                href="https://github.com/nakafaai/nakafa.com"
                rel="noopener noreferrer"
                target="_blank"
                title={t("source-code")}
              >
                <span className="sr-only">{t("source-code")}</span>
                <IconBrandGithub className="size-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("source-code")}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                aria-label={t("videos")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-8 shrink-0"
                )}
                href="https://www.youtube.com/@nakafaa"
                rel="noopener noreferrer"
                target="_blank"
                title={t("videos")}
              >
                <span className="sr-only">{t("videos")}</span>
                <IconBrandYoutube className="size-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("videos")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </HeaderContainer>
  );
}
