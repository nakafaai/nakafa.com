import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { Effect } from "effect";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NinaPrompt } from "@/components/ai/message/prompt";
import {
  LESSON_SECTION_ID,
  type Lesson as LessonId,
} from "@/components/marketing/about/lesson/id";
import {
  AtomPlaceholder,
  CellPlaceholder,
  CirclePlaceholder,
  ProjectilePlaceholder,
} from "@/components/marketing/about/lesson/placeholder";
import { readHomeLessons } from "@/components/marketing/about/lesson/published";
import { LessonWindow } from "@/components/marketing/about/lesson/window.client";
import { applyContentCache } from "@/lib/content/cache";
import { getMaterialModel } from "@/lib/content/material/publication";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { decimalSeparators } from "@/lib/marketing/decimal";

/**
 * Reads the window's four lessons for one locale through the cached material
 * reader. The `use cache` function is the framework's Promise boundary, so the
 * page still prerenders with its lessons. Trace timing stays off, because a span
 * reads the clock when it starts and Cache Components reject implicit clock access
 * during prerendering. https://nextjs.org/docs/messages/next-prerender-current-time
 */
async function readLessons(locale: AppLocaleCode) {
  "use cache";

  applyContentCache("material");
  return await Effect.runPromise(
    readHomeLessons(locale, getMaterialModel).pipe(
      Effect.withTracerTiming(false)
    )
  );
}

/**
 * The lessons row: a short chat with Nina on one side and the lesson window on
 * the other. The chat uses the product's own bubbles, and the window holds four
 * published lessons, each named and described by the lesson itself.
 */
export async function Lesson() {
  const locale = getLocaleOrThrow(await getLocale());
  const [t, tCommon, format, lessons] = await Promise.all([
    getTranslations({ locale, namespace: "Landing" }),
    getTranslations({ locale, namespace: "Common" }),
    getFormatter({ locale }),
    readLessons(locale),
  ]);
  const decimalSeparator = decimalSeparators[locale];
  const placeholders: Record<LessonId, ReactNode> = {
    atom: (
      <AtomPlaceholder
        labels={{
          atomicNumber: t("lab.atom.atomic-number"),
          chooseAtom: t("lab.atom.choose"),
          configuration: t("lab.atom.configuration"),
          electronTotal: t("lab.atom.electron-total"),
          maximumCapacity: t("lab.atom.capacity"),
          outerShell: t("lab.atom.outer-shell"),
        }}
      />
    ),
    cell: (
      <CellPlaceholder
        labels={{
          chooseMode: t("lab.bacteria.choose"),
          tabs: [
            t("lab.bacteria.shape.tab"),
            t("lab.bacteria.inside.tab"),
            t("lab.bacteria.wall.tab"),
          ],
          viewLabel: t("lab.bacteria.view"),
        }}
      />
    ),
    circle: (
      <CirclePlaceholder
        formatNumber={(value) =>
          format.number(value, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: false,
          })
        }
        labels={{ radian: tCommon("radian") }}
      />
    ),
    projectile: (
      <ProjectilePlaceholder
        decimalSeparator={decimalSeparator}
        labels={{
          chooseLaunch: t("lab.projectile.choose"),
          factLabels: {
            flightTime: t("lab.projectile.flight-time"),
            initialSpeed: t("lab.projectile.initial-speed"),
            peakHeight: t("lab.projectile.peak-height"),
            range: t("lab.projectile.range"),
          },
          viewLabel: t("lab.projectile.view"),
        }}
      />
    ),
  };

  return (
    <section
      className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32"
      id={LESSON_SECTION_ID}
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <div className="grid gap-4">
            <Message align="end">
              <NinaPrompt text={t("lesson-ask")} />
            </Message>
            <Message>
              <MessageContent>
                <MarkdownContent id="home-lesson-answer" variant="chat">
                  {t("lesson-answer")}
                </MarkdownContent>
              </MessageContent>
            </Message>
          </div>
          <div className="grid gap-3">
            <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
              {t("lesson-title")}
            </h2>
            <p className="max-w-xl text-pretty text-base text-muted-foreground">
              {t("lesson-lead")}
            </p>
          </div>
        </div>
        <div className="min-w-0">
          <LessonWindow
            decimalSeparator={decimalSeparator}
            label={t("lesson-tabs")}
            lessons={lessons}
            openLabel={t("lesson-open")}
            placeholders={placeholders}
          />
        </div>
      </div>
    </section>
  );
}
