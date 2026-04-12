import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserSettingsProfilePage } from "@/components/user/settings/profile-page";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/settings">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("settings"),
    description: t("settings-description"),
  };
}

export default function Page() {
  return <UserSettingsProfilePage />;
}
