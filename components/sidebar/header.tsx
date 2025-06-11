import { cn } from "@/lib/utils";
import { IconBrandGithub, IconBrandYoutube } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { HeaderContainer } from "./header-container";
import { HeaderSearch } from "./header-search";

export function Header() {
  const t = useTranslations("Common");
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-6 sm:w-full">
          <SidebarTrigger side="left" className="size-8" variant="outline" />
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          <HeaderSearch />
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/nakafaai/nakafa.com"
                title={t("source-code")}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-8 shrink-0"
                )}
                aria-label={t("source-code")}
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
                href="https://www.youtube.com/@nakafaa"
                title={t("videos")}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-8 shrink-0"
                )}
                aria-label={t("videos")}
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
