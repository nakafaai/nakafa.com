import { HttpClient } from "@confect/js";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Clock, Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MEMORY_PAGE } from "@/components/user/settings/memory/list";
import { UserSettingsMemory } from "@/components/user/settings/memory/view";
import { admitAccountRoute } from "@/lib/account/server";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";

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
 * Resolves the first page of memories and whether memory is paused inside the
 * settings route stream, with the moment the server read them. The browser
 * shows them until its own live list answers. The page counts every
 * "confirmed" time from that moment in the browser too, so the browser renders
 * the words the server rendered.
 */
async function AuthenticatedMemory({
  params,
}: {
  params: PageProps<"/[locale]/user/settings/memory">["params"];
}) {
  const { token } = await admitAccountRoute((await params).locale);
  const { first, now, state } = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        Effect.all(
          {
            first: client.query(nina.memory.list, {
              paginationOpts: { cursor: null, numItems: MEMORY_PAGE },
            }),
            state: client.query(nina.memory.state, {}),
          },
          { concurrency: "unbounded" }
        )
      ),
      Effect.flatMap((read) =>
        Effect.map(Clock.currentTimeMillis, (now) => ({ ...read, now }))
      ),
      Effect.provide(httpLayer(token ? { auth: token } : {}))
    )
  );
  if (!state) {
    notFound();
  }
  return <UserSettingsMemory first={first} now={now} paused={state.paused} />;
}
