import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { UserChats } from "@/components/user/chats";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/[id]/chat">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("chat"),
    description: t("chat-description"),
    alternates: {
      canonical: `/${locale}/user/${id}/chat`,
    },
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/[id]/chat">) {
  const { id } = use(params);
  return <UserChats userId={id as Id<"users">} />;
}
