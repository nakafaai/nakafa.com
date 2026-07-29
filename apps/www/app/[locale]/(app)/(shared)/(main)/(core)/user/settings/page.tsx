import { api } from "@repo/backend/convex/_generated/api";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserSettingsCurriculum } from "@/components/user/settings/curriculum";
import { UserSettingsProfilePage } from "@/components/user/settings/profile-page";
import { preloadAuthQuery } from "@/lib/auth/server";
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

export default async function Page({
  params,
}: PageProps<"/[locale]/user/settings">) {
  const locale = getLocaleOrThrow((await params).locale);
  const [preloadedPrograms, preloadedPreference] = await Promise.all([
    preloadAuthQuery(api.learningPreferences.queries.listCurriculumPrograms, {
      locale,
    }),
    preloadAuthQuery(api.learningPreferences.queries.getCurrent, { locale }),
  ]);

  return (
    <UserSettingsProfilePage>
      <UserSettingsCurriculum
        preloadedPreference={preloadedPreference}
        preloadedPrograms={preloadedPrograms}
      />
    </UserSettingsProfilePage>
  );
}
