import { String as Str } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense, use } from "react";
import { UserComments } from "@/components/user/comments";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { profileHref } from "@/lib/profile/href";
import { readProfile } from "@/lib/profile/server";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/[username]/comments">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, username } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("profile"),
    description: t("profile-description"),
    alternates: {
      canonical: `/${locale}${profileHref(Str.toLowerCase(username))}/comments`,
    },
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/[username]/comments">) {
  return (
    <Suspense fallback={null}>
      <UserCommentsRoute params={params} />
    </Suspense>
  );
}

/** Resolves the profile inside the nearest streaming boundary. */
function UserCommentsRoute({
  params,
}: Pick<PageProps<"/[locale]/user/[username]/comments">, "params">) {
  const { username } = use(params);
  const { account } = use(readProfile(username));
  return <UserComments userId={account.appUser._id} />;
}
