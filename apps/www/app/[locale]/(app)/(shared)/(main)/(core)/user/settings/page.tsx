import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsProfilePage } from "@/components/user/settings/profile";
import { admitAccountRoute } from "@/lib/account/server";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/settings">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("settings"),
    description: t("settings-description"),
  };
}

export default function Page({ params }: PageProps<"/[locale]/user/settings">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedSettings params={params} />
    </Suspense>
  );
}

/** Resolves the account cards inside the settings route stream. */
async function AuthenticatedSettings({
  params,
}: {
  params: PageProps<"/[locale]/user/settings">["params"];
}) {
  const { token } = await admitAccountRoute((await params).locale);
  const account = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(auth.queries.getCurrentUser, {})),
      Effect.provide(httpLayer(token ? { auth: token } : {}))
    )
  );
  if (!account) {
    notFound();
  }
  return <UserSettingsProfilePage initialAccount={account} />;
}
