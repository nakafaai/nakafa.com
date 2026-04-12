import { api } from "@repo/backend/convex/_generated/api";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(
  props: PageProps<"/[locale]/school/select">
) {
  const locale = getLocaleOrThrow((await props.params).locale);
  const token = await getToken();

  if (!token) {
    redirect(`/${locale}/auth?redirect=/school/select`);
  }

  const [t, schools] = await Promise.all([
    getTranslations({ locale, namespace: "School.Onboarding" }),
    fetchQuery(api.schools.queries.getMySchools, {}, { token }),
  ]);

  if (schools.length === 0) {
    redirect(`/${locale}/school/onboarding`);
  }

  if (schools.length === 1) {
    redirect(`/${locale}/school/${schools[0].slug}`);
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

      <section className="grid gap-4">
        {schools.map((school) => (
          <NavigationLink
            className="flex flex-col gap-2 rounded-xl border bg-card px-5 py-4 shadow-sm transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))]"
            href={`/school/${school.slug}`}
            key={school._id}
          >
            <h2 className="font-medium text-lg">{school.name}</h2>
            <p className="text-muted-foreground text-sm">{t(school.type)}</p>
          </NavigationLink>
        ))}
      </section>

      <NavigationLink
        className="mx-auto text-primary text-sm underline-offset-4 hover:underline"
        href="/school/onboarding"
      >
        {t("add-school")}
      </NavigationLink>
    </main>
  );
}
