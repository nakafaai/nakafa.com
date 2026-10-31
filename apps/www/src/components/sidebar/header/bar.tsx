import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { useTranslations } from "use-intl";
import { HeaderContainer } from "@/components/sidebar/header/frame";
import { HeaderSearch } from "@/components/sidebar/search/trigger";
import { useMissedPress } from "@/lib/press/replay";

/**
 * The phone's way into the sidebar. It is in the page's HTML, so a press before
 * React takes the page over opens the sidebar once React mounts it, and a slow
 * phone never shows a dead button.
 */
function HeaderSidebarToggle() {
  const tCommon = useTranslations("Common");
  const toggleSidebar = useSidebar((sidebar) => sidebar.toggleSidebar);
  const press = useMissedPress<HTMLButtonElement>(toggleSidebar);

  return (
    <SidebarTrigger
      className="size-9 lg:hidden"
      label={tCommon("toggle-sidebar")}
      variant="outline"
      {...press}
    />
  );
}

/** Renders the app header controls shared by authenticated learning pages. */
export function Header() {
  return (
    <HeaderContainer>
      <div className="flex w-full items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-6 sm:w-full">
          <HeaderSidebarToggle />
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          <HeaderSearch />
        </div>
      </div>
    </HeaderContainer>
  );
}
