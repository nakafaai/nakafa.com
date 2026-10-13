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
  params: PageProps<"/[locale]/user/[username]">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, username } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const [t, profile] = await Promise.all([
    getTranslations({ locale, namespace: "Auth" }),
    readProfile(username),
  ]);

  return {
    title: t("profile"),
    description: t("profile-description"),
    alternates: {
      canonical: `/${locale}${profileHref(profile.username)}`,
    },
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/[username]">) {
  return (
    <Suspense fallback={null}>
      <UserCommentsRoute params={params} />
    </Suspense>
  );
}

/** Resolves the profile inside the nearest streaming boundary. */
function UserCommentsRoute({
  params,
}: Pick<PageProps<"/[locale]/user/[username]">, "params">) {
  const { username } = use(params);
  const { _id } = use(readProfile(username));
  return <UserComments userId={_id} />;
}
