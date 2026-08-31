import { redirect } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Theme } from "@/components/marketing/shared/footer-action";
import { OnboardingQuestionnaire } from "@/components/programs/onboarding/questionnaire";
import {
  EntryShell,
  EntryShellArtwork,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/shared/entry-shell";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { readOnboardingStatus } from "@/lib/onboarding/server";

/** Builds localized metadata for the first-run questionnaire. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/onboarding">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "LearningPrograms" });
  return {
    description: t("metadata-description"),
    title: t("metadata-title"),
  };
}

export default function Page(props: PageProps<"/[locale]/onboarding">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedOnboarding params={props.params} />
    </Suspense>
  );
}

/** Resolves auth and draft state before mounting the focused questionnaire. */
async function AuthenticatedOnboarding({
  params,
}: {
  params: PageProps<"/[locale]/onboarding">["params"];
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
    redirect({ href: "/auth?redirect=/onboarding", locale });
    return null;
  }

  const status = await Effect.runPromise(readOnboardingStatus(token));
  if (!status.isRequired) {
    redirect({ href: "/home", locale });
    return null;
  }

  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <div className="ms-auto">
            <Theme variant="ghost" />
          </div>
        </EntryShellHeader>
        <EntryShellBody>
          <OnboardingQuestionnaire initialProfile={status.profile} />
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
