import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import {
  SidebarScope,
  SidebarScopeStart,
} from "@repo/design-system/components/ui/sidebar-scope";

export const card = {
  name: "SidebarScope",
  group: "Navigation",
  height: 110,
  source: "sidebar-scope",
};

/** The card's live example. */
export function Preview() {
  return (
    <SidebarProvider className="min-h-0">
      <SidebarScope>
        <header className="flex items-center gap-3 px-4 py-3">
          <SidebarScopeStart label="Outline" />
          <p className="font-semibold">Lesson outline</p>
        </header>
      </SidebarScope>
    </SidebarProvider>
  );
}
