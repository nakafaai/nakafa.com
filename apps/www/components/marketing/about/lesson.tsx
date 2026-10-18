import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import { Nina } from "@repo/design-system/components/ui/nina";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  LESSON_SECTION_ID,
  LESSON_SUBJECTS,
  type Lesson as LessonId,
} from "@/components/marketing/about/lesson/id";
import {
  getAtomLabels,
  getCellLabels,
  getProjectileLabels,
} from "@/components/marketing/about/lesson/labels";
import {
  AtomPlaceholder,
  CellPlaceholder,
  CirclePlaceholder,
  ProjectilePlaceholder,
} from "@/components/marketing/about/lesson/placeholder";
import { LessonWindow } from "@/components/marketing/about/lesson/window.client";
import { Turn } from "@/components/marketing/about/turn";
import { MarketingSection } from "@/components/marketing/shared/section";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { decimalSeparators } from "@/lib/marketing/decimal";

/**
 * The lessons row: a short talk with Nina and the row's title on one side, and
 * the lesson window on the other, with one lesson of each subject on its tab.
 */
export async function Lesson() {
  const locale = getLocaleOrThrow(await getLocale());
  const [t, tCommon, tSubject, format] = await Promise.all([
    getTranslations({ locale, namespace: "Landing" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
    getFormatter({ locale }),
  ]);
  const decimalSeparator = decimalSeparators[locale];
  // Each card and its lab read their labels from the same builder, so the card and the lab agree.
  const placeholders: Record<LessonId, ReactNode> = {
    atom: <AtomPlaceholder labels={getAtomLabels(t)} />,
    cell: <CellPlaceholder labels={getCellLabels(t)} />,
    circle: (
      <CirclePlaceholder
        formatNumber={(value, options) => format.number(value, options)}
        labels={{
          onAxis: tCommon("on-axis"),
          quadrant: tCommon("quadrant"),
          radian: tCommon("radian"),
        }}
      />
    ),
    projectile: (
      <ProjectilePlaceholder
        decimalSeparator={decimalSeparator}
        labels={getProjectileLabels(t)}
      />
    ),
  };

  const subjects: Record<LessonId, string> = {
    atom: tSubject(LESSON_SUBJECTS.atom),
    cell: tSubject(LESSON_SUBJECTS.cell),
    circle: tSubject(LESSON_SUBJECTS.circle),
    projectile: tSubject(LESSON_SUBJECTS.projectile),
  };

  return (
    <MarketingSection id={LESSON_SECTION_ID}>
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <div className="grid gap-2">
            <Nina act="waving" label="" size={88} whole />
            <h2 className="text-balance text-2xl tracking-tight">
              {t("lesson-title")}
            </h2>
            <p className="max-w-md text-pretty text-base text-muted-foreground">
              {t("lesson-lead")}
            </p>
          </div>
          <Turn ask={t("lesson-ask")}>
            <MarkdownContent id="home-lesson-answer" variant="chat">
              {t("lesson-answer")}
            </MarkdownContent>
          </Turn>
        </div>
        <div className="min-w-0">
          <LessonWindow
            decimalSeparator={decimalSeparator}
            label={t("lesson-tabs")}
            placeholders={placeholders}
            subjects={subjects}
          />
        </div>
      </div>
    </MarketingSection>
  );
}
