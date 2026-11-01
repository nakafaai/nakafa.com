import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutContent } from "@/components/shared/content/frame";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { UserSettingsHeader } from "@/components/user/settings/header";
import { SETTINGS_PANEL_ID } from "@/components/user/settings/panel";
import { useLeafRoutePath } from "@/lib/routing/link";
import { getUserSettingsSection } from "@/lib/settings/routes";

/**
 * The settings section: its header above the page body, and the place where a
 * settings page puts a panel on a wide screen. A library draws its own header,
 * whose search filters what stands under it, and fills the frame with its panes.
 * The reference keeps private settings out of search, which the child pages'
 * heads state.
 */
export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings"
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { isLibrary } = getUserSettingsSection(useLeafRoutePath());

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        {isLibrary ? (
          <Outlet />
        ) : (
          <>
            <UserSettingsHeader />
            <LayoutContent className="flex flex-col gap-6 py-6">
              <Outlet />
            </LayoutContent>
          </>
        )}
      </LayoutMaterialContent>
      <div className="contents" id={SETTINGS_PANEL_ID} />
    </LayoutMaterial>
  );
}
