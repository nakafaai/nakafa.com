import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsCurriculum } from "@/components/user/settings/curriculum";
import { UserSettingsProfilePage } from "@/components/user/settings/profile-page";
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
  const locale = await admitUserSettingsRoute((await params).locale);

  const curriculum = await Effect.runPromise(
    captureUserSettingsPreload(
      Effect.all(
        {
          preloadedPreference: preloadUserSettingsQuery(() =>
            preloadAuthQuery(api.learningPreferences.queries.getCurrent, {
              locale,
            })
          ),
          preloadedPrograms: preloadUserSettingsQuery(() =>
            preloadAuthQuery(
              api.learningPreferences.queries.listCurriculumPrograms,
              { locale }
            )
          ),
        },
        { concurrency: "unbounded" }
      )
    )
  );

  return (
    <UserSettingsProfilePage>
      {Option.match(curriculum, {
        onNone: () => null,
        onSome: ({ preloadedPreference, preloadedPrograms }) => (
          <UserSettingsCurriculum
            preloadedPreference={preloadedPreference}
            preloadedPrograms={preloadedPrograms}
          />
        ),
      })}
    </UserSettingsProfilePage>
  );
}
