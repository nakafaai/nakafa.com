import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { HeaderContainer } from "./header-container";
import { HeaderSearch } from "./header-search";

export function Header() {
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-6 sm:w-full">
          <SidebarTrigger className="size-8" variant="outline" />
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          <HeaderSearch />
        </div>
      </div>
    </HeaderContainer>
  );
}
