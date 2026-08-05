import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense, use } from "react";
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

export default function Page({ params }: PageProps<"/[locale]/user/[id]">) {
  return (
    <Suspense fallback={null}>
      <UserCommentsRoute params={params} />
    </Suspense>
  );
}

/** Resolves the profile id inside the nearest streaming boundary. */
function UserCommentsRoute({
  params,
}: Pick<PageProps<"/[locale]/user/[id]">, "params">) {
  const { id } = use(params);
  return <UserComments userId={id as Id<"users">} />;
}
