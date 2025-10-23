import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserSettingsProfilePage } from "@/components/user/settings/profile-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");

  return {
    title: t("settings"),
  };
}

export default function Page() {
  return <UserSettingsProfilePage />;
}
