import { api } from "@repo/backend/convex/_generated/api";
import { redirect } from "@repo/internationalization/src/navigation";
import { fetchQuery } from "convex/nextjs";
import type { Locale } from "next-intl";
import { Suspense } from "react";
import { FocusStepForm } from "@/components/programs/onboarding/focus";
import { GuestProgramDiscovery } from "@/components/programs/onboarding/guest";
import {
  getInitialFocusKey,
  getRoleOptionForKey,
  getSelectableRoleOptions,
  hasOnboardingChoices,
  parseOnboardingRole,
} from "@/components/programs/onboarding/model";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import {
  getActiveLearningProfile,
  getLearningProgramOnboardingCatalog,
} from "@/lib/programs/server";

/** Renders the route-owned focus form step for normal Nakafa onboarding. */
export default async function Page(
  props: PageProps<"/[locale]/onboarding/focus">
) {
  const params = await props.params;
  const locale = getLocaleOrThrow(params.locale);

  return (
    <Suspense fallback={null}>
      <FocusStepRuntime locale={locale} />
    </Suspense>
  );
}

/** Reads route data for the focus step while keeping form state local. */
async function FocusStepRuntime({ locale }: { locale: Locale }) {
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

  const [currentUser, activeProfile] = await Promise.all([
    fetchQuery(api.auth.queries.getCurrentUser, {}, { token }),
    getActiveLearningProfile(token, locale),
  ]);
  const roleOptions = getSelectableRoleOptions(programs);
  const selectedRole = getRoleOptionForKey(
    roleOptions,
    parseOnboardingRole(currentUser?.appUser.role)
  )?.key;

  if (!selectedRole) {
    redirect({ href: "/onboarding/role", locale });
    return null;
  }

  return (
    <FocusStepForm
      initialFocusKey={getInitialFocusKey({
        activeProfile,
        programs,
        role: selectedRole,
      })}
      programs={programs}
      role={selectedRole}
    />
  );
}
