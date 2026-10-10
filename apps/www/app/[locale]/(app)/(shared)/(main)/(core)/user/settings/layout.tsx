import type { Metadata } from "next";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { UserSettingsHeader } from "@/components/user/settings/header";

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
 * Renders the settings section header above the settings body. On a wide
 * screen it makes room on the end side while the Memory page's editor is open.
 */
export default function Layout({
  children,
}: LayoutProps<"/[locale]/user/settings">) {
  return (
    <LayoutMaterial className="xl:has-data-[slot=memory-editor-open]:pe-112">
      <LayoutMaterialContent>
        <UserSettingsHeader />
        <LayoutContent className="flex flex-col gap-6 py-6">
          {children}
        </LayoutContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
