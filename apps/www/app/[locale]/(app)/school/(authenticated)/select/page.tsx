import { api } from "@repo/backend/convex/_generated/api";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SchoolSelectList } from "@/components/school/select-list";
import { fetchAuthQuery, getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Render the school selection page for users who belong to many schools. */
export default function Page(props: PageProps<"/[locale]/school/select">) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedSchoolSelection params={props.params} />
    </Suspense>
  );
}

/** Resolves the authenticated school catalog inside the route stream. */
async function AuthenticatedSchoolSelection({
  params,
}: {
  params: PageProps<"/[locale]/school/select">["params"];
}) {
  const [{ locale: rawLocale }, token] = await Promise.all([
    params,
    getToken(),
  ]);

  if (!token) {
    return null;
  }

  const locale = getLocaleOrThrow(rawLocale);

  const [t, landingState] = await Promise.all([
    getTranslations({ locale, namespace: "School.Onboarding" }),
    fetchAuthQuery(api.schools.queries.getMySchoolLandingState, {}),
  ]);

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
