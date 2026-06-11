import NavigationLink from "@repo/design-system/components/navigation/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SchoolSelectList } from "@/components/school/select-list";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getSchoolLandingRouteState } from "@/lib/school/server";

/** Render the school selection page for users who belong to many schools. */
export default async function Page(
  props: PageProps<"/[locale]/school/select">
) {
  const locale = getLocaleOrThrow((await props.params).locale);

  const [t, landingState] = await Promise.all([
    getTranslations({ locale, namespace: "School.Onboarding" }),
    getSchoolLandingRouteState(),
  ]);

  if (landingState.kind === "unauthenticated") {
    const redirectPath = `/${locale}/school/select`;
    redirect(`/${locale}/auth?redirect=${encodeURIComponent(redirectPath)}`);
  }

  if (landingState.kind === "none") {
    redirect(`/${locale}/school/onboarding`);
  }

  if (landingState.kind === "single") {
    redirect(`/${locale}/school/${landingState.slug}`);
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-3 text-center">
        <h1 className="text-pretty font-medium text-2xl tracking-tighter sm:text-3xl">
          {t("schools")}
        </h1>
        <p className="text-pretty text-muted-foreground sm:text-lg">
          {t("description")}
        </p>
      </header>

      <SchoolSelectList />

      <NavigationLink
        className="mx-auto text-primary text-sm underline-offset-4 hover:underline"
        href="/school/onboarding"
      >
        {t("add-school")}
      </NavigationLink>
    </main>
  );
}
