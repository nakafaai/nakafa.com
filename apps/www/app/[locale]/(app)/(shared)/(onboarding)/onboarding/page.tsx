import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { LEARNING_INTEREST_VALUES } from "@repo/contents/_types/program/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LearningProgramOnboardingForm } from "@/components/programs/onboarding/form";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import {
  getActiveLearningProfile,
  getLearningProgramOnboardingCatalog,
} from "@/lib/programs/server";

/** Builds localized metadata for the learning program onboarding route. */
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

/** Renders the localized learning program onboarding surface. */
export default async function Page(props: PageProps<"/[locale]/onboarding">) {
  const locale = getLocaleOrThrow((await props.params).locale);

  return (
    <main className="flex min-h-dvh w-full items-start justify-center px-4 py-10 sm:px-6">
      <Suspense fallback={<OnboardingSkeleton />}>
        <LearningProgramOnboardingRuntime locale={locale} />
      </Suspense>
    </main>
  );
}

/** Reads catalog/profile data and renders the correct onboarding state. */
async function LearningProgramOnboardingRuntime({
  locale,
}: {
  locale: Locale;
}) {
  const [programs, token] = await Promise.all([
    getLearningProgramOnboardingCatalog(locale),
    getToken(),
  ]);

  if (!token) {
    return <GuestProgramDiscovery />;
  }

  const profile = await getActiveLearningProfile(token);

  return (
    <LearningProgramOnboardingForm
      activeProfile={profile ?? undefined}
      interestValues={LEARNING_INTEREST_VALUES}
      locale={locale}
      programs={programs}
    />
  );
}

/** Shows the sign-in prompt for visitors who have not signed in yet. */
async function GuestProgramDiscovery() {
  const t = await getTranslations("LearningPrograms");

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl sm:text-4xl">
          {t("onboarding.auth-title")}
        </h1>
        <p className="text-muted-foreground">{t("onboarding.auth-helper")}</p>
      </div>
      <Button
        nativeButton={false}
        render={
          <NavigationLink href="/auth">
            {t("onboarding.auth-cta")}
            <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
          </NavigationLink>
        }
        size="lg"
      />
    </section>
  );
}

/** Renders a compact loading state while onboarding data streams. */
function OnboardingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-5 w-full max-w-sm" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}
