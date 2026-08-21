import { redirect } from "@repo/internationalization/src/navigation";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FocusStepForm } from "@/components/programs/onboarding/focus";
import { GuestProgramDiscovery } from "@/components/programs/onboarding/guest";
import { hasOnboardingChoices } from "@/components/programs/onboarding/model";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import {
  getActiveLearningSelection,
  getLearningProgramOnboardingCatalog,
} from "@/lib/programs/server";

/** Renders the route-owned focus form step for normal Nakafa onboarding. */
export default async function Page(
  props: PageProps<"/[locale]/onboarding/focus">
) {
  const params = await props.params;
  const locale = getLocaleOrThrow(params.locale);

  if (!isActiveLocale(locale)) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <FocusStepRuntime locale={locale} />
    </Suspense>
  );
}

/** Reads route data for the focus step while keeping form state local. */
async function FocusStepRuntime({ locale }: { locale: PublicAppLocale }) {
  const [programs, token] = await Promise.all([
    getLearningProgramOnboardingCatalog(locale),
    getToken(),
  ]);

  if (!token) {
    return <GuestProgramDiscovery />;
  }

  if (!hasOnboardingChoices(programs)) {
    redirect({ href: "/home", locale });
    return null;
  }

  const activeSelection = await getActiveLearningSelection(token, locale);

  return (
    <FocusStepForm activeSelection={activeSelection} programs={programs} />
  );
}
