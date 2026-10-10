import { HttpClient } from "@confect/js";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Clock, Effect } from "effect";
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

/**
 * Resolves the memories inside the settings route stream, with the moment the
 * server read them. The page counts every "confirmed" time from that moment in
 * the browser too, so the browser renders the words the server rendered.
 */
async function AuthenticatedMemory({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/memory">["params"];
}) {
  const { token } = await admitUserSettingsRoute((await params).locale);
  const { memory, now } = await Effect.runPromise(
    Effect.all({
      memory: HttpClient.HttpClient.pipe(
        Effect.flatMap((client) => client.query(nina.memory.list, {}))
      ),
      now: Clock.currentTimeMillis,
    }).pipe(Effect.provide(httpLayer(token ? { auth: token } : {})))
  );
  if (!memory) {
    notFound();
  }
  return <UserSettingsMemory initialList={memory} now={now} />;
}
