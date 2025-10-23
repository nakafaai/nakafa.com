import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserSettingsSubscriptionsPage } from "@/components/user/settings/subscriptions-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");

  return {
    title: t("subscriptions"),
  };
}

export default function Page() {
  return <UserSettingsSubscriptionsPage />;
}
