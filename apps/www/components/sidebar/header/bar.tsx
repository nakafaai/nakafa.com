import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import { useTranslations } from "use-intl";
import { HeaderContainer } from "@/components/sidebar/header/frame";
import { HeaderSearch } from "@/components/sidebar/search/trigger";

/** Renders the app header controls shared by authenticated learning pages. */
export function Header() {
  const tCommon = useTranslations("Common");

  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-6 sm:w-full">
          <SidebarTrigger
            className="size-9"
            label={tCommon("toggle-sidebar")}
            variant="outline"
          />
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          <HeaderSearch />
        </div>
      </div>
    </HeaderContainer>
  );
}
