import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserComments } from "@/components/user/comments";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/[id]">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("profile"),
    description: t("profile-description"),
    alternates: {
      canonical: `/${locale}/user/${id}`,
    },
  };
}

export default function Page(props: PageProps<"/[locale]/user/[id]">) {
  const { params } = props;
  const { locale: rawLocale, id } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  // Enable static rendering
  setRequestLocale(locale);

  return <UserComments userId={id as Id<"users">} />;
}
