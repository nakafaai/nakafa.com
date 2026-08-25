import {
  AiFileIcon,
  ArrowUpRight01Icon,
  BookOpenTextIcon,
} from "@hugeicons/core-free-icons";
import {
  BlockMath,
  InlineMath,
} from "@repo/design-system/components/markdown/math";
import {
  MdxHeading3,
  MdxStrong,
} from "@repo/design-system/components/markdown/mdx";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TrustLayout } from "./layout";
import { buildTrustSourceExcerpt, type TrustLessonExcerpt } from "./source";

/** Applies the existing marketing accent to one intentional phrase. */
function renderAccent(chunks: ReactNode) {
  return <mark>{chunks}</mark>;
}

/** Renders the learner-facing side with Nakafa's shared MDX components. */
function TrustLessonPreview({
  excerpt,
  headingIdPrefix,
  lessonHref,
}: {
  excerpt: TrustLessonExcerpt;
  headingIdPrefix: string;
  lessonHref: string;
}) {
  const t = useTranslations("TrustSection");

  return (
    <div className="h-full min-w-0 overflow-hidden bg-background">
      <div className="flex h-14 items-center justify-between gap-3 border-b px-6 text-sm sm:px-8 lg:px-10">
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
        className="px-6 py-7 sm:px-8 lg:px-10 lg:py-8"
      >
        <div className="mx-auto max-w-3xl">
          <MdxHeading3 id={`${headingIdPrefix}-opening`}>
            {excerpt.heading}
          </MdxHeading3>
          <Paragraph>
            {excerpt.openingBeforeFolds} <InlineMath math={excerpt.foldsMath} />
            {excerpt.openingAfterFolds}{" "}
            <MdxStrong>{excerpt.growthTerm}</MdxStrong>.
          </Paragraph>
          <Paragraph>
            {excerpt.growthBeforeYear} <InlineMath math={excerpt.yearMath} />
            {excerpt.growthAfterYear}
          </Paragraph>
          <MdxHeading3 id={`${headingIdPrefix}-definition`}>
            {excerpt.definitionHeading}
          </MdxHeading3>
          <Paragraph>{excerpt.definition}</Paragraph>
          <BlockMath math={excerpt.sequenceMath} />
        </div>
      </article>
    </div>
  );
}

/** Renders the matching localized Markdown excerpt as open source text. */
function TrustSourcePreview({
  excerpt,
  sourceHref,
}: {
  excerpt: TrustLessonExcerpt;
  sourceHref: string;
}) {
  const t = useTranslations("TrustSection");

  return (
    <aside
      aria-label={t("source-preview-label")}
      className="h-full min-w-0 overflow-hidden bg-foreground text-background"
    >
      <div className="flex h-14 items-center justify-between gap-3 border-background/20 border-b px-6 text-sm sm:px-8 lg:px-10">
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
      <pre className="whitespace-pre-wrap break-words px-6 py-7 font-mono text-xs leading-6 sm:px-8 sm:text-sm lg:px-10 lg:py-8">
        <code>{buildTrustSourceExcerpt(excerpt)}</code>
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
  excerpt,
  lessonHref,
  sourceHref,
}: {
  excerpt: TrustLessonExcerpt;
  lessonHref: string;
  sourceHref: string;
}) {
  const t = useTranslations("TrustSection");

  return (
    <div className="border-t">
      <TrustLayout
        lesson={
          <TrustLessonPreview
            excerpt={excerpt}
            headingIdPrefix="trust-comparison"
            lessonHref={lessonHref}
          />
        }
        resizeLabel={t("comparison-slider-label")}
        source={
          <TrustSourcePreview excerpt={excerpt} sourceHref={sourceHref} />
        }
      />
    </div>
  );
}

/** Renders the source-backed trust chapter on the marketing homepage. */
export function Trust({
  lessonHref,
  sourceHref,
}: {
  lessonHref: string;
  sourceHref: string;
}) {
  const t = useTranslations("TrustSection");
  const excerpt: TrustLessonExcerpt = {
    definition: t("lesson-definition"),
    definitionHeading: t("lesson-definition-heading"),
    foldsMath: String(t.raw("lesson-folds-math")),
    growthAfterYear: t("lesson-growth-after-year"),
    growthBeforeYear: t("lesson-growth-before-year"),
    growthTerm: t("lesson-growth-term"),
    heading: t("lesson-heading"),
    openingAfterFolds: t("lesson-opening-after-folds"),
    openingBeforeFolds: t("lesson-opening-before-folds"),
    sequenceMath: String(t.raw("lesson-sequence-math")),
    yearMath: String(t.raw("lesson-year-math")),
  };

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
              <IntentLink href={lessonHref}>
                {t("open-lesson")}
                <HugeIcons icon={ArrowUpRight01Icon} />
              </IntentLink>
            }
          />
        </div>

        <TrustComparison
          excerpt={excerpt}
          lessonHref={lessonHref}
          sourceHref={sourceHref}
        />
      </div>
    </section>
  );
}
