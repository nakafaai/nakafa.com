import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserSettingsSubscriptionsPage } from "@/components/user/settings/subscriptions-page";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/subscriptions">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("subscriptions"),
    description: t("subscriptions-description"),
  };
}

export default function Page(
  props: PageProps<"/[locale]/user/settings/subscriptions">
) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  // Enable static rendering
  setRequestLocale(locale);

  return <UserSettingsSubscriptionsPage />;
}
