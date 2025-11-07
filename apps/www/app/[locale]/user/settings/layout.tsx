import { type Locale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserSettingsTabs } from "@/components/user/settings/tabs";

export default function Layout(props: LayoutProps<"/[locale]/user/settings">) {
  const { children, params } = props;
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale as Locale);

  const t = useTranslations("Auth");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-medium text-lg sm:text-xl">{t("settings")}</h1>

      <UserSettingsTabs />
      {children}
    </div>
  );
}
