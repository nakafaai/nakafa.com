import { Either } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { UserComments } from "@/components/user/comments";
import { decodeUserId } from "@/lib/data/convex-ids";
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

export default function Page({ params }: PageProps<"/[locale]/user/[id]">) {
  const { id } = use(params);
  const userId = decodeUserId(id);

  if (Either.isLeft(userId)) {
    notFound();
  }

  return <UserComments userId={userId.right} />;
}
