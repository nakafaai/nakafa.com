import {
  AiFileIcon,
  ArrowUpRight01Icon,
  BookOpenTextIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TrustLayout } from "@/components/marketing/about/trust/layout";
import type { PublishedTrustLesson } from "@/lib/content/material/trust";

/** Applies the existing marketing accent to one intentional phrase. */
function renderAccent(chunks: ReactNode) {
  return <mark>{chunks}</mark>;
}

/** Renders the learner-facing side with Nakafa's shared MDX components. */
function TrustLessonPreview({
  body,
  lessonHref,
}: Pick<PublishedTrustLesson, "body" | "lessonHref">) {
  const t = useTranslations("TrustSection");

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-6 text-sm sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <HugeIcons className="size-4" icon={BookOpenTextIcon} />
          <span className="truncate">{t("human-label")}</span>
        </div>
        <Button
          nativeButton={false}
          render={
            <NavigationLink
              href={lessonHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("open-lesson-short")}
              <HugeIcons icon={ArrowUpRight01Icon} />
            </NavigationLink>
          }
          size="sm"
          variant="ghost"
        />
      </div>
      <article
        aria-label={t("lesson-preview-label")}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8 lg:px-10 lg:py-8"
      >
        <div className="mx-auto max-w-3xl">{body}</div>
      </article>
    </div>
  );
}

/** Shows the matching authored body without non-rendered metadata. */
function TrustSourcePreview({
  sourceBody,
  sourceHref,
}: Pick<PublishedTrustLesson, "sourceBody" | "sourceHref">) {
  const t = useTranslations("TrustSection");

  return (
    <aside
      aria-label={t("source-preview-label")}
      className="flex h-full min-w-0 flex-col overflow-hidden bg-foreground text-background"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-background/20 border-b px-6 text-sm sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 text-background/70">
          <HugeIcons className="size-4" icon={AiFileIcon} />
          <span className="truncate">{t("agent-label")}</span>
        </div>
        <Button
          className="text-background hover:bg-background/10 hover:text-background hover:[&_svg]:text-background"
          nativeButton={false}
          render={
            <NavigationLink
              href={sourceHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("open-source")}
              <HugeIcons icon={ArrowUpRight01Icon} />
            </NavigationLink>
          }
          size="sm"
          variant="ghost"
        />
      </div>
      <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-6 py-7 font-mono text-xs leading-6 sm:px-8 sm:text-sm lg:px-10 lg:py-8">
        <code>{sourceBody}</code>
      </pre>
    </aside>
  );
}

/**
 * Places the rendered lesson and source in one bounded comparison surface.
 *
 * Desktop uses an accessible resizable grid. Compact screens show the same
 * content nodes at full width so neither proof becomes a narrow column.
 */
function TrustComparison({
  body,
  lessonHref,
  sourceBody,
  sourceHref,
}: PublishedTrustLesson) {
  const t = useTranslations("TrustSection");

  return (
    <div className="border-t">
      <TrustLayout
        lesson={<TrustLessonPreview body={body} lessonHref={lessonHref} />}
        resizeLabel={t("comparison-slider-label")}
        source={
          <TrustSourcePreview sourceBody={sourceBody} sourceHref={sourceHref} />
        }
      />
    </div>
  );
}

/** Renders the source-backed trust chapter on the marketing homepage. */
export function Trust({ lesson }: { lesson: PublishedTrustLesson }) {
  const t = useTranslations("TrustSection");

  return (
    <section className="scroll-mt-28 border-b" id="trust">
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="px-6 py-24 sm:py-28 lg:px-10 lg:py-32">
          <h2 className="max-w-4xl text-balance text-3xl tracking-tight sm:text-4xl">
            {t.rich("headline", {
              mark: renderAccent,
            })}
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("description")}
          </p>
          <Button
            className="mt-8"
            nativeButton={false}
            render={
              <IntentLink href={lesson.lessonHref}>
                {t("open-lesson")}
                <HugeIcons icon={ArrowUpRight01Icon} />
              </IntentLink>
            }
          />
        </div>

        <TrustComparison {...lesson} />
      </div>
    </section>
  );
}
