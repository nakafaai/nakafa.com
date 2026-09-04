import { redirect } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdmissionPending } from "@/components/auth/pending";
import { Theme } from "@/components/marketing/shared/footer-action";
import { OnboardingQuestionnaire } from "@/components/programs/onboarding/questionnaire";
import {
  EntryShell,
  EntryShellArtwork,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/shared/entry-shell";
import {
  getPostAuthDestination,
  getPostAuthSignInHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { recordOnboardingAdmission } from "@/lib/onboarding/server";

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
    <Suspense fallback={<AdmissionPending />}>
      <AuthenticatedOnboarding
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}

/** Resolves auth and draft state before mounting the focused questionnaire. */
async function AuthenticatedOnboarding({
  params,
  searchParams,
}: {
  params: PageProps<"/[locale]/onboarding">["params"];
  searchParams: PageProps<"/[locale]/onboarding">["searchParams"];
}) {
  const [{ locale: rawLocale }, query, token] = await Promise.all([
    params,
    searchParams,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);
  if (!isActiveLocale(locale)) {
    notFound();
  }
  const intent = resolvePostAuthIntent(query.intent, locale);
  if (!token) {
    redirect({ href: getPostAuthSignInHref(intent), locale });
    return null;
  }

  const status = await Effect.runPromise(recordOnboardingAdmission(token));
  if (!status.isAuthenticated) {
    redirect({ href: getPostAuthSignInHref(intent), locale });
    return null;
  }
  if (!status.isRequired) {
    redirect(getPostAuthDestination(intent, locale));
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
          <OnboardingQuestionnaire
            initialProfile={status.profile}
            intent={intent}
          />
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}
