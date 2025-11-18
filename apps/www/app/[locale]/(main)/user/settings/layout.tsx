import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserSettingsTabs } from "@/components/user/settings/tabs";

export default function Layout(props: LayoutProps<"/[locale]/user/settings">) {
  const { children, params } = props;
  const { locale } = use(params);

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  const t = useTranslations("Auth");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="px-2 font-medium text-lg sm:text-xl">{t("settings")}</h1>

      <UserSettingsTabs />
      {children}
    </div>
  );
}
