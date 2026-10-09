import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsCurriculum } from "@/components/user/settings/curriculum";
import { UserSettingsMemory } from "@/components/user/settings/memory";
import { UserSettingsProfilePage } from "@/components/user/settings/profile";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { admitUserSettingsRoute } from "@/lib/settings/server";

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
  const { locale, token } = await admitUserSettingsRoute((await params).locale);
  const data = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        Effect.all(
          {
            account: client.query(auth.queries.getCurrentUser, {}),
            memory: client.query(nina.memory.get, {}),
            preference: client.query(learningPreferences.queries.getCurrent, {
              locale,
            }),
            programs: client.query(
              learningPreferences.queries.listCurriculumPrograms,
              { locale }
            ),
          },
          { concurrency: "unbounded" }
        )
      ),
      Effect.provide(httpLayer(token ? { auth: token } : {}))
    )
  );
  if (!data.account) {
    notFound();
  }
  return (
    <UserSettingsProfilePage initialAccount={data.account}>
      <UserSettingsCurriculum
        initialPreference={data.preference}
        initialPrograms={data.programs}
        locale={locale}
      />
      <UserSettingsMemory initialMemory={data.memory} />
    </UserSettingsProfilePage>
  );
}
