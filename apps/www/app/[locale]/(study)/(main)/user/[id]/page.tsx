import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserComments } from "@/components/user/comments";

interface Props {
  params: Promise<{
    locale: Locale;
    id: Id<"users">;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("profile"),
    description: t("profile-description"),
    alternates: {
      canonical: `/${locale}/user`,
    },
  };
}

export default function Page({ params }: Props) {
  const { locale, id } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <UserComments userId={id} />;
}
