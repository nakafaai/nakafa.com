import type { Metadata } from "next";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { UserSettingsHeader } from "@/components/user/settings/header";
import { SETTINGS_PANEL_ID } from "@/components/user/settings/panel";

/** Keeps private account settings out of search and social discovery. */
export const metadata: Metadata = {
  alternates: null,
  openGraph: null,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  twitter: null,
};

/**
 * Renders the settings section header above the settings body, and beside
 * them the place where a settings page can put a panel on a wide screen.
 */
export default function Layout({
  children,
}: LayoutProps<"/[locale]/user/settings">) {
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <UserSettingsHeader />
        <LayoutContent className="flex flex-col gap-6 py-6">
          {children}
        </LayoutContent>
      </LayoutMaterialContent>
      <div className="contents" id={SETTINGS_PANEL_ID} />
    </LayoutMaterial>
  );
}
