import { redirect } from "@repo/internationalization/src/navigation";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GuestProgramDiscovery } from "@/components/programs/onboarding/guest";
import { hasOnboardingChoices } from "@/components/programs/onboarding/model";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getLearningProgramOnboardingCatalog } from "@/lib/programs/server";

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
    <Suspense fallback={null}>
      <LearningProgramOnboardingRuntime locale={locale} />
    </Suspense>
  );
}

/** Routes users to the first concrete onboarding step when setup can proceed. */
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

  if (!hasOnboardingChoices(programs)) {
    redirect({ href: "/home", locale });
    return null;
  }

  redirect({ href: "/onboarding/role", locale });
  return null;
}
