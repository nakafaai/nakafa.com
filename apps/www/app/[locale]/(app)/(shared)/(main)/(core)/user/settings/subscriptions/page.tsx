import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";
import { preloadAuthQuery } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import {
  admitUserSettingsRoute,
  captureUserSettingsPreload,
  preloadUserSettingsQuery,
} from "@/lib/settings/server";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/subscriptions">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("subscriptions"),
    description: t("subscriptions-description"),
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/settings/subscriptions">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedSubscriptions params={params} />
    </Suspense>
  );
}

/** Resolves the billing card inside the settings route stream. */
async function AuthenticatedSubscriptions({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/subscriptions">["params"];
}) {
  await admitUserSettingsRoute((await params).locale);

  const subscription = await Effect.runPromise(
    captureUserSettingsPreload(
      preloadUserSettingsQuery(() =>
        preloadAuthQuery(api.subscriptions.queries.hasActiveSubscription, {
          productId: products.pro.id,
        })
      )
    )
  );

  return Option.match(subscription, {
    onNone: () => null,
    onSome: (preloadedSubscription) => (
      <UserSettingsSubscriptions
        preloadedSubscription={preloadedSubscription}
      />
    ),
  });
}
