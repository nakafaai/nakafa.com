import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Page } from "@/components/shared/page/frame";
import { SETTINGS_PANEL_ID } from "@/components/user/settings/panel";

/**
 * The settings section: the page column, and the place where a settings page
 * puts a panel on a wide screen. Each page draws its own header and body, so the
 * frame on screen is always the frame of the page on screen, and a press keeps
 * the page it leaves whole until the next one renders. The reference keeps
 * private settings out of search, which the child pages' heads state.
 */
export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings"
)({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex">
      <Page>
        <Outlet />
      </Page>
      <div className="contents" id={SETTINGS_PANEL_ID} />
    </div>
  );
}
