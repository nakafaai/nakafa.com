import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { UserSettingsTabs } from "@/components/user/settings/tabs";

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

/** Render the user settings shell inside the validated locale subtree. */
export default function Layout({
  children,
}: LayoutProps<"/[locale]/user/settings">) {
  const t = useTranslations("Auth");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="px-2 font-medium text-lg sm:text-xl">{t("settings")}</h1>

      <UserSettingsTabs />
      {children}
    </div>
  );
}
