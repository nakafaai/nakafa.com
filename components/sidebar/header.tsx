import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { buttonVariants } from "../ui/button";
import { GithubIcon } from "../ui/icons";
import { SidebarTrigger } from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function Header() {
  const t = useTranslations("Common");
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 size-9" />

        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/nabilfatih/nakafa.com"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" })
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
