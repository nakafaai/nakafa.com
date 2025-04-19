import { cn } from "@/lib/utils";
import { IconBrandGithub, IconBrandYoutube } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { HeaderContainer } from "./header-container";
import { SearchBar } from "./search-bar";

export function Header() {
  const t = useTranslations("Common");
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-2 sm:w-full">
          <SidebarTrigger className="size-9" variant="outline" />
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          <SearchBar />
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/nabilfatih/nakafa.com"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "shrink-0"
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
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "shrink-0"
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
