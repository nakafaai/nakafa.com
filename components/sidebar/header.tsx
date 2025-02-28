import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { buttonVariants } from "../ui/button";
import { GithubIcon } from "../ui/icons";
import { SidebarTrigger } from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { HeaderBreadcrumb } from "./header-breadcrumb";
import { SearchBar } from "./search-bar";

export function Header() {
  const t = useTranslations("Common");
  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-sm transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 size-8" />

        <HeaderBreadcrumb />

        <div className="ml-auto flex items-center gap-2">
          <SearchBar />
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/nabilfatih/nakafa.com"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-8"
                )}
              >
                <GithubIcon className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("source-code")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
