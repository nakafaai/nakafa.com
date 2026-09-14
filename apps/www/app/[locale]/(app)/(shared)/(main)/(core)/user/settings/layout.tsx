import type { Metadata } from "next";
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

/** Renders the settings section header above the settings body. */
export default function Layout({
  children,
}: LayoutProps<"/[locale]/user/settings">) {
  return (
    <div className="flex flex-col">
      <UserSettingsHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        {children}
      </div>
    </div>
  );
}
