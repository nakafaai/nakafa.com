import { HttpClient } from "@confect/js";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsMemory } from "@/components/user/settings/memory/view";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { admitUserSettingsRoute } from "@/lib/settings/server";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/memory">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("memory"),
    description: t("memory-description"),
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/settings/memory">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedMemory params={params} />
    </Suspense>
  );
}

/** Resolves the memories inside the settings route stream. */
async function AuthenticatedMemory({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/memory">["params"];
}) {
  const { token } = await admitUserSettingsRoute((await params).locale);
  const memory = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(nina.memory.list, {})),
      Effect.provide(httpLayer(token ? { auth: token } : {}))
    )
  );
  if (!memory) {
    notFound();
  }
  return <UserSettingsMemory initialList={memory} />;
}
