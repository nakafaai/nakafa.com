import { api } from "@repo/backend/convex/_generated/api";
import { redirect } from "@repo/internationalization/src/navigation";
import { Effect, Option, Schema } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserSettingsCurriculum } from "@/components/user/settings/curriculum";
import { UserSettingsProfilePage } from "@/components/user/settings/profile-page";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/server";
import { getToken, preloadAuthQuery } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

class UserSettingsCurriculumPreloadError extends Schema.TaggedError<UserSettingsCurriculumPreloadError>()(
  "UserSettingsCurriculumPreloadError",
  { cause: Schema.Unknown }
) {}

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

/** Resolves account data inside the settings route stream. */
async function AuthenticatedSettings({
  params,
}: {
  params: PageProps<"/[locale]/user/settings">["params"];
}) {
  const [{ locale: rawLocale }, token] = await Promise.all([
    params,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);

  if (!isActiveLocale(locale)) {
    notFound();
  }

  if (!token) {
    redirect({ href: "/auth", locale });
    return null;
  }

  const curriculum = await Effect.runPromise(
    Effect.all(
      {
        preloadedPreference: Effect.tryPromise({
          catch: (cause) => new UserSettingsCurriculumPreloadError({ cause }),
          try: () =>
            preloadAuthQuery(api.learningPreferences.queries.getCurrent, {
              locale,
            }),
        }),
        preloadedPrograms: Effect.tryPromise({
          catch: (cause) => new UserSettingsCurriculumPreloadError({ cause }),
          try: () =>
            preloadAuthQuery(
              api.learningPreferences.queries.listCurriculumPrograms,
              { locale }
            ),
        }),
      },
      { concurrency: "unbounded" }
    ).pipe(
      Effect.map(Option.some),
      Effect.catchTag("UserSettingsCurriculumPreloadError", (error) =>
        scheduleCurrentServerExceptionCapture(error.cause, {
          source: "user-settings-curriculum-preload",
        }).pipe(Effect.as(Option.none()))
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
