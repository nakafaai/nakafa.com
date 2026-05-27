import { Either } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { UserChats } from "@/components/user/chats";
import { decodeUserId } from "@/lib/data/convex-ids";
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
  const userId = decodeUserId(id);

  if (Either.isLeft(userId)) {
    notFound();
  }

  return <UserChats userId={userId.right} />;
}
