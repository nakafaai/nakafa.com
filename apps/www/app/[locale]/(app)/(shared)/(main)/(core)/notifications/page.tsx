import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { NotificationsFeed } from "@/components/notifications/feed";
import { NotificationsHeader } from "@/components/notifications/header";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { admitAccountRoute } from "@/lib/account/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/notifications">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Notifications" });

  return { title: t("title") };
}

/** The inbox of the signed-in account, in the app shell. */
export default function Page({ params }: PageProps<"/[locale]/notifications">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedNotifications params={params} />
    </Suspense>
  );
}

/** Admits the signed-in account before the inbox renders. */
async function AuthenticatedNotifications({
  params,
}: {
  params: PageProps<"/[locale]/notifications">["params"];
}) {
  await admitAccountRoute((await params).locale);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <NotificationsHeader />
        <LayoutContent className="flex flex-col gap-6 py-6">
          <NotificationsFeed />
        </LayoutContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
