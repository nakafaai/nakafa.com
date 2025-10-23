import { useTranslations } from "next-intl";
import { UserSettingsTabs } from "@/components/user/settings/tabs";

export default function Layout(props: LayoutProps<"/[locale]/user/settings">) {
  const t = useTranslations("Auth");
  const { children } = props;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-medium text-lg sm:text-xl">{t("settings")}</h1>

      <UserSettingsTabs />
      {children}
    </div>
  );
}
