import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { getLocale, getTranslations } from "next-intl/server";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { LessonWindow } from "@/components/marketing/about/lesson/window.client";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { decimalSeparators } from "@/lib/marketing/decimal";

/**
 * The lessons row: a short chat with Nina on one side and the lesson window on
 * the other. The chat uses the product's own bubbles, and the window holds the
 * lessons, each with its text above its picture. The server reads the locale,
 * so the window's client code never needs it.
 */
export async function Lesson() {
  const locale = getLocaleOrThrow(await getLocale());
  const t = await getTranslations({ locale, namespace: "Landing" });

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="lesson">
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
            decimalSeparator={decimalSeparators[locale]}
            label={t("lesson-tabs")}
            lessons={{
              cell: { tab: t("lesson-cell"), text: t("lesson-cell-text") },
              mole: { tab: t("lesson-mole"), text: t("lesson-mole-text") },
              projectile: {
                tab: t("lesson-projectile"),
                text: t("lesson-projectile-text"),
              },
              quadratic: {
                tab: t("lesson-quadratic"),
                text: t("lesson-quadratic-text"),
              },
            }}
          />
        </div>
      </div>
    </section>
  );
}
