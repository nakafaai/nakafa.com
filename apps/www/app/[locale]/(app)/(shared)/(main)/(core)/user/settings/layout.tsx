import { useTranslations } from "next-intl";
import { UserSettingsTabs } from "@/components/user/settings/tabs";

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
