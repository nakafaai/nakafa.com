import { Books02Icon } from "@hugeicons/core-free-icons";
import { getCategoryIcon } from "@repo/contents/_lib/subject/category";
import {
  getAllGradesWithSubjects,
  getGradeNonNumeric,
} from "@repo/contents/_lib/subject/grade";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Effect } from "effect";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { getGradeIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/subject/icons";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/subject">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const [tCommon, tSubject] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
  ]);

  const path = `/${locale}/subject`;
  const title = tCommon("subject");
  const description = tSubject("subject-description");
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, "/subject"),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

export default function Page(props: PageProps<"/[locale]/subject">) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  return <PageContent locale={locale} />;
}

/** Reads subject grade listings inside a Next Cache Components boundary. */
async function getCachedGradesWithSubjects() {
  "use cache";
  cacheLife("max");

  return Effect.runSync(getAllGradesWithSubjects());
}

async function PageContent({ locale }: { locale: Locale }) {
  const allGrades = await getCachedGradesWithSubjects();
  const categoryOrder = Array.from(
    new Set(allGrades.map((grade) => grade.category))
  );
  const [tCommon, tSubject] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
  ]);

  const groupedByCategory = new Map(
    categoryOrder.map((category) => [
      category,
      allGrades.filter((grade) => grade.category === category),
    ])
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("subject"), path: "/subject" },
        ])}
      />
      <HeaderContent
        description={tSubject("subject-description")}
        icon={Books02Icon}
        title={tCommon("subject")}
      />
      <LayoutContent>
        <div className="flex flex-col gap-12 pb-24">
          {categoryOrder.map((category) => {
            const grades = groupedByCategory.get(category);
            if (!grades || grades.length === 0) {
              return null;
            }

            const CategoryIcon = getCategoryIcon(category);

            return (
              <section className="flex flex-col gap-6" key={category}>
                <div className="flex items-center gap-2">
                  <HugeIcons className="size-5" icon={CategoryIcon} />
                  <h2 className="font-medium text-lg">{tSubject(category)}</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {grades.map((grade) => {
                    const gradeLabel = tSubject(
                      getGradeNonNumeric(grade.grade) ?? "grade",
                      { grade: grade.grade }
                    );

                    const IconComponent = getGradeIcon(grade.grade);

                    return (
                      <NavigationLink
                        className="group flex flex-col items-center gap-2"
                        href={grade.href}
                        key={grade.grade}
                        prefetch
                      >
                        <div className="flex aspect-[1/0.95] w-full items-center justify-center rounded-xl bg-muted/50 transition-all ease-out group-hover:bg-muted">
                          <IconComponent />
                        </div>
                        <h3 className="text-center">{gradeLabel}</h3>
                      </NavigationLink>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </LayoutContent>
    </>
  );
}
