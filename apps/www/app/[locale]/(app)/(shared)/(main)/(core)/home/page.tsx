import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { redirect } from "@repo/internationalization/src/navigation";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { shouldRequireLearningProgramOnboarding } from "@/lib/programs/catalog";
import {
  getActiveLearningSelection,
  getLearningProgramOnboardingCatalog,
} from "@/lib/programs/server";

/** Routes authenticated users through canonical learning selection. */
export default function Page(props: PageProps<"/[locale]/home">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedHome params={props.params} />
    </Suspense>
  );
}

/** Resolves request auth and learning state inside the route stream. */
async function AuthenticatedHome({
  params,
}: {
  params: PageProps<"/[locale]/home">["params"];
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

  const learningSelection = await getActiveLearningSelection(token, locale);
  if (!learningSelection) {
    const programs = await getLearningProgramOnboardingCatalog(locale);

    if (shouldRequireLearningProgramOnboarding(learningSelection, programs)) {
      redirect({ href: "/onboarding/role", locale });
      return null;
    }
  }

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <Main locale={locale} />
    </div>
  );
}

/** Renders the authenticated home feed in the existing Nakafa home order. */
function Main({ locale }: { locale: ActiveAppLocaleCode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative flex flex-col gap-12">
        <HomeHeader />

        <HomeExplore />

        <HomeContinueLearning />

        <Suspense fallback={null}>
          <HomeTrending locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
