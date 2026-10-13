import { String as Str } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense, use } from "react";
import { UserChats } from "@/components/user/chats";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { profileHref } from "@/lib/profile/href";
import { readProfile } from "@/lib/profile/server";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/[username]/chat">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, username } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("chat"),
    description: t("chat-description"),
    alternates: {
      canonical: `/${locale}${profileHref(Str.toLowerCase(username))}/chat`,
    },
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/[username]/chat">) {
  return (
    <Suspense fallback={null}>
      <UserChatsRoute params={params} />
    </Suspense>
  );
}

/** Resolves the profile inside the nearest streaming boundary. */
function UserChatsRoute({
  params,
}: Pick<PageProps<"/[locale]/user/[username]/chat">, "params">) {
  const { username } = use(params);
  const { account } = use(readProfile(username));
  return <UserChats userId={account.appUser._id} />;
}
