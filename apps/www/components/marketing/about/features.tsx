import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SubjectsArt } from "@/components/marketing/about/features/subjects";
import { FeaturesTryout } from "@/components/marketing/about/features/tryout";
import { FeaturesNina } from "@/components/marketing/about/nina/section";
import { FeaturesProjectile } from "@/components/marketing/about/projectile/features";
import { SubjectItem } from "@/components/shared/subject/item";
import { SubjectList } from "@/components/shared/subject/list";
import { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { getPublishedProgramSubjects } from "@/lib/content/program/catalog";
import { readCurriculumRouteIcon } from "@/lib/curriculum/icons";

export async function Features({ locale }: { locale: Locale }) {
  const [t, subjects, featuredTryout] = await Promise.all([
    getTranslations({ locale, namespace: "Features" }),
    getPublishedProgramSubjects(locale),
    readFeaturedTryout(locale),
  ]);
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
        <div className="relative grid grid-cols-1 overflow-hidden border-t bg-background text-foreground lg:grid-cols-12">
          <div className="relative min-h-152 overflow-hidden border-b bg-background lg:col-span-7 lg:min-h-160 lg:border-r">
            <SubjectsArt />
            <div className="relative z-1 flex min-h-152 flex-col gap-12 p-8 lg:min-h-160 lg:p-10">
              <h3 className="max-w-2xl text-balance text-3xl tracking-tight sm:text-4xl">
                {t.rich("subjects-title", {
                  mark: (chunks) => <mark>{chunks}</mark>,
                })}
              </h3>
              <SubjectList
                aria-label={t("subjects-navigation")}
                className="mt-auto w-full max-w-lg"
              >
                {subjects.map((route) => (
                  <SubjectItem
                    href={`/${locale}/${route.publicPath}`}
                    icon={readCurriculumRouteIcon(route)}
                    key={route.publicPath}
                    label={route.title}
                    labelElement="span"
                  />
                ))}
              </SubjectList>
            </div>
          </div>
          <FeaturesTryout value={featuredTryout} />
          <FeaturesNina />
          <FeaturesProjectile />
        </div>
      </div>
    </section>
  );
}
