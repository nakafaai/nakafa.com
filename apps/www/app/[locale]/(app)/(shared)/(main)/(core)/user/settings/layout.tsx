import { useTranslations } from "next-intl";
import { use } from "react";
import { UserSettingsTabs } from "@/components/user/settings/tabs";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(props: LayoutProps<"/[locale]/user/settings">) {
  const { children, params } = props;
  getLocaleOrThrow(use(params).locale);

  const t = useTranslations("Auth");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="px-2 font-medium text-lg sm:text-xl">{t("settings")}</h1>

      <UserSettingsTabs />
      {children}
    </div>
  );
}
