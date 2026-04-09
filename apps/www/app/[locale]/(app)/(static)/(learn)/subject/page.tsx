import { Books02Icon } from "@hugeicons/core-free-icons";
import { getCategoryIcon } from "@repo/contents/_lib/subject/category";
import {
  getAllGradesWithSubjects,
  getGradeNonNumeric,
} from "@repo/contents/_lib/subject/grade";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGradeIcon } from "./icons";

const CATEGORY_ORDER = ["middle-school", "high-school", "university"] as const;

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

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Nakafa",
      locale,
      type: "website",
    },
  };
}

export default function Page(props: PageProps<"/[locale]/subject">) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  return <PageContent locale={locale} />;
}

async function PageContent({ locale }: { locale: Locale }) {
  const [allGrades, tCommon, tSubject] = await Promise.all([
    getAllGradesWithSubjects(CATEGORY_ORDER),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
  ]);

  const groupedByCategory = new Map(
    CATEGORY_ORDER.map((category) => [
      category,
      allGrades.filter((grade) => grade.category === category),
    ])
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={allGrades.map((grade, index) => ({
          "@type": "ListItem" as const,
          "@id": `https://nakafa.com/${locale}${grade.href}`,
          position: index + 1,
          name: tSubject(getGradeNonNumeric(grade.grade) ?? "grade", {
            grade: grade.grade,
          }),
          item: `https://nakafa.com/${locale}${grade.href}`,
        }))}
      />
      <HeaderContent
        description={tSubject("subject-description")}
        icon={Books02Icon}
        title={tCommon("subject")}
      />
      <LayoutContent>
        <div className="flex flex-col gap-12 pb-24">
          {CATEGORY_ORDER.map((category) => {
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
