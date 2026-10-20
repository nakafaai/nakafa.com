import { Nina } from "@repo/design-system/components/ui/nina";
import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
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
import { NINA_SLOT } from "@/components/marketing/about/toys/slot";
import {
  FeatureLead,
  FeatureProduct,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";
import { decimalSeparators } from "@/lib/marketing/decimal";

/**
 * The lessons row: a short talk with Nina and the row's title on one side, and
 * the lesson window on the other, with one lesson of each subject on its tab.
 */
export async function Lesson({ locale }: { readonly locale: Locale }) {
  const [t, tCommon, tSubject] = await Promise.all([
    readServerTranslator({ locale, namespace: "Landing" }),
    readServerTranslator({ locale, namespace: "Common" }),
    readServerTranslator({ locale, namespace: "Subject" }),
  ]);
  const decimalSeparator = decimalSeparators[locale];
  // Each card and its lab read their labels from the same builder, so the card and the lab agree.
  const placeholders: Record<LessonId, ReactNode> = {
    atom: <AtomPlaceholder labels={getAtomLabels(t)} />,
    cell: <CellPlaceholder labels={getCellLabels(t)} />,
    circle: (
      <CirclePlaceholder
        formatNumber={(value, options) =>
          new Intl.NumberFormat(locale, options).format(value)
        }
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
    <FeatureRow id={LESSON_SECTION_ID}>
      <FeatureText>
        <span className="inline-block" id={NINA_SLOT.lesson}>
          <Nina act="waving" label="" size={88} whole />
        </span>
        <FeatureTitle>{t("lesson-title")}</FeatureTitle>
        <FeatureLead>{t("lesson-lead")}</FeatureLead>
      </FeatureText>
      <FeatureProduct>
        <LessonWindow
          decimalSeparator={decimalSeparator}
          label={t("lesson-tabs")}
          placeholders={placeholders}
          subjects={subjects}
        />
      </FeatureProduct>
    </FeatureRow>
  );
}
