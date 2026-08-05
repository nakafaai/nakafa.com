import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import { FeaturesBento } from "@/components/marketing/about/features-bento";
import { readTryoutHubPage } from "@/components/tryout/catalog/server";
import { getPublishedProgramRoutes } from "@/lib/content/program/catalog";

export async function Features({ locale }: { locale: Locale }) {
  const [t, catalog, tryoutPage] = await Promise.all([
    getTranslations({ locale, namespace: "Features" }),
    getPublishedProgramRoutes(locale),
    readTryoutHubPage(locale),
  ]);
  const subjectPaths = catalog.routes
    .filter((route) => route.level === "subject" && route.sitemap)
    .slice(0, 4)
    .map((route) => ({
      href: `/${locale}/${route.publicPath}`,
      icon: readCurriculumRouteIcon(route),
      title: route.title,
    }));

  return (
    <section
      className="relative isolate z-0 scroll-mt-28 border-y bg-background"
      id="features"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="px-6 py-24 sm:py-28 lg:px-10 lg:py-32">
          <h2 className="max-w-4xl text-balance text-3xl tracking-tight sm:text-4xl">
            {t.rich("story", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
        </div>
        <FeaturesBento
          subjectPaths={subjectPaths}
          tryoutCountries={tryoutPage.countries}
        />
      </div>
    </section>
  );
}
