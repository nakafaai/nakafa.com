import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { UserChats } from "@/components/user/chats";

interface Props {
  params: Promise<{
    locale: Locale;
    id: Id<"users">;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("chat"),
    description: t("chat-description"),
    alternates: {
      canonical: `/${locale}/user/${id}/chat`,
    },
  };
}

export default function Page({ params }: Props) {
  const { locale, id } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <UserChats userId={id} />;
}
