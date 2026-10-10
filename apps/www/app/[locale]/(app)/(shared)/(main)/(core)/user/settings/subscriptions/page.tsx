import { HttpClient } from "@confect/js";
import subscriptions from "@repo/backend/confect/_generated/refs/subscriptions";
import { products } from "@repo/backend/confect/customers/polar/products";
import { Effect } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { admitUserSettingsRoute } from "@/lib/settings/server";

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
  const { token } = await admitUserSettingsRoute((await params).locale);
  const subscription = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        client.query(subscriptions.queries.hasActiveSubscription, {
          productId: products.pro.id,
        })
      ),
      Effect.provide(httpLayer(token ? { auth: token } : {}))
    )
  );
  return <UserSettingsSubscriptions initialSubscription={subscription} />;
}
