import { redirect } from "@repo/internationalization/src/navigation";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeLearningProgram } from "@/components/home/learning-program";
import { HomeTrending } from "@/components/home/trending";
import type { ActiveLearningProfile } from "@/components/programs/contract";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { shouldRequireLearningProgramOnboarding } from "@/lib/programs/catalog";
import {
  getActiveLearningProfile,
  getLearningProgramOnboardingCatalog,
} from "@/lib/programs/server";

/** Routes authenticated users into their active learning plan. */
export default async function Page(props: PageProps<"/[locale]/home">) {
  const [{ locale: rawLocale }, token] = await Promise.all([
    props.params,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);

  if (!token) {
    redirect({ href: "/auth", locale });
    return null;
  }

  const learningProfile = await getActiveLearningProfile(token);
  if (!learningProfile) {
    const programs = await getLearningProgramOnboardingCatalog(locale);

    if (shouldRequireLearningProgramOnboarding(learningProfile, programs)) {
      redirect({ href: "/onboarding", locale });
      return null;
    }
  }

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <Main learningProfile={learningProfile} />
    </div>
  );
}

/** Renders the authenticated home feed around the selected learning program. */
function Main({
  learningProfile,
}: {
  learningProfile: NonNullable<ActiveLearningProfile> | null;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative flex flex-col gap-12">
        <HomeHeader />

        {learningProfile ? (
          <HomeLearningProgram profile={learningProfile} />
        ) : null}

        <HomeExplore />

        <HomeContinueLearning />

        <HomeTrending />
      </div>
    </div>
  );
}
