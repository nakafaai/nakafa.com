import { redirect } from "@repo/internationalization/src/navigation";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuestProgramDiscovery } from "@/components/programs/onboarding/guest";
import {
  getSelectableRoleOptions,
  hasOnboardingChoices,
} from "@/components/programs/onboarding/model";
import { RoleStepForm } from "@/components/programs/onboarding/role";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getLearningProgramOnboardingCatalog } from "@/lib/programs/server";

/** Renders the route-owned role form step for normal Nakafa onboarding. */
export default async function Page(
  props: PageProps<"/[locale]/onboarding/role">
) {
  const locale = getLocaleOrThrow((await props.params).locale);

  if (!isActiveLocale(locale)) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <RoleStepRuntime locale={locale} />
    </Suspense>
  );
}

/** Reads route data for the role step without moving form state into the route. */
async function RoleStepRuntime({ locale }: { locale: PublicAppLocale }) {
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

  const options = getSelectableRoleOptions(programs);

  return <RoleStepForm options={options} />;
}
