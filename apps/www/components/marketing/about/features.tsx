import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { useLocale, useTranslations } from "next-intl";
import { readCurriculumRouteIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/icons";
import { FeaturesBento } from "@/components/marketing/about/features-bento";

const FEATURE_SUBJECT_NODE_KEYS = new Set([
  "class-10-biology",
  "class-10-chemistry",
  "class-10-mathematics",
  "class-10-physics",
]);

export function Features() {
  const t = useTranslations("Features");
  const locale = useLocale();
  const subjectPaths = readStaticPublicCurriculumRoutes().flatMap((route) => {
    const isFeaturedSubject =
      route.locale === locale &&
      route.level === "subject" &&
      FEATURE_SUBJECT_NODE_KEYS.has(route.nodeKey) &&
      route.sitemap;

    if (!isFeaturedSubject) {
      return [];
    }

    return [
      {
        href: `/${route.locale}/${route.publicPath}`,
        icon: readCurriculumRouteIcon(route),
        title: route.title,
      },
    ];
  });

  return (
    <section
      className="relative isolate z-0 scroll-mt-28 border-y bg-background"
      id="features"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="px-6 py-24 sm:py-28 lg:px-10 lg:py-32">
          <h2 className="max-w-4xl text-pretty text-3xl tracking-tight sm:text-4xl">
            {t.rich("story", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
        </div>
        <FeaturesBento subjectPaths={subjectPaths} />
      </div>
    </section>
  );
}
