import {
  AiFileIcon,
  ArrowUpRight01Icon,
  BookOpenTextIcon,
} from "@hugeicons/core-free-icons";
import { toLocalizedContentHref } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import {
  BlockMath,
  InlineMath,
} from "@repo/design-system/components/markdown/math";
import {
  MdxHeading2,
  MdxStrong,
} from "@repo/design-system/components/markdown/mdx";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/design-system/components/ui/resizable";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const TRUST_MATERIAL_KEY = "lesson.mathematics.exponential-logarithm";
const TRUST_SECTION_KEY = "basic-concept";

/** Applies the existing marketing accent to one intentional phrase. */
function renderAccent(chunks: ReactNode) {
  return <mark>{chunks}</mark>;
}

/**
 * Resolves the localized exponent lesson through the canonical static content
 * route projection used by the learning app.
 */
function readTrustLessonHref(locale: Locale) {
  for (const candidate of readStaticPublicContentRoutes()) {
    if (
      candidate.locale === locale &&
      candidate.materialKey === TRUST_MATERIAL_KEY &&
      candidate.kind === "subject-lesson" &&
      candidate.sectionKey === TRUST_SECTION_KEY
    ) {
      return toLocalizedContentHref(candidate);
    }
  }

  notFound();
}

/** Renders the learner-facing side with Nakafa's shared MDX components. */
function TrustLessonPreview({ lessonHref }: { lessonHref: string }) {
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
          <MdxHeading2>{t("lesson-heading")}</MdxHeading2>
          <Paragraph>
            {t("lesson-opening-before-folds")}{" "}
            <InlineMath math={String(t.raw("lesson-folds-math"))} />
            {t("lesson-opening-after-folds")}{" "}
            <MdxStrong>{t("lesson-growth-term")}</MdxStrong>.
          </Paragraph>
          <MdxHeading2>{t("lesson-definition-heading")}</MdxHeading2>
          <Paragraph>{t("lesson-definition")}</Paragraph>
          <BlockMath math={String(t.raw("lesson-sequence-math"))} />
        </div>
      </article>
    </div>
  );
}

/** Renders the matching localized Markdown excerpt as open source text. */
function TrustSourcePreview({ sourceHref }: { sourceHref: string }) {
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
        <code>
          {String(t.raw("source-opening"))}
          {String(t.raw("source-definition"))}
        </code>
      </pre>
    </aside>
  );
}

/**
 * Places the rendered lesson and source in one bounded comparison surface.
 *
 * Desktop uses Nakafa's accessible resizable panels. Compact screens show both
 * views at full width so neither proof becomes an unreadable narrow column.
 */
function TrustComparison({
  lessonHref,
  sourceHref,
}: {
  lessonHref: string;
  sourceHref: string;
}) {
  const t = useTranslations("TrustSection");

  return (
    <div className="border-t">
      <div className="grid divide-y md:hidden">
        <TrustLessonPreview lessonHref={lessonHref} />
        <TrustSourcePreview sourceHref={sourceHref} />
      </div>
      <div className="hidden h-[34rem] md:block">
        <ResizablePanelGroup
          defaultLayout={{
            "trust-human": 50,
            "trust-agent": 50,
          }}
          id="trust-comparison"
          orientation="horizontal"
          resizeTargetMinimumSize={{
            coarse: 44,
            fine: 24,
          }}
        >
          <ResizablePanel id="trust-human" maxSize="64%" minSize="36%">
            <TrustLessonPreview lessonHref={lessonHref} />
          </ResizablePanel>
          <ResizableHandle
            aria-label={t("comparison-slider-label")}
            disableDoubleClick
            withHandle
          />
          <ResizablePanel id="trust-agent" maxSize="64%" minSize="36%">
            <TrustSourcePreview sourceHref={sourceHref} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

/** Renders the source-backed trust chapter on the marketing homepage. */
export function Trust({ locale }: { locale: Locale }) {
  const t = useTranslations("TrustSection");
  const lessonHref = readTrustLessonHref(locale);
  const sourceHref = `${lessonHref}.md`;

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
              <NavigationLink href={lessonHref}>
                {t("open-lesson")}
                <HugeIcons icon={ArrowUpRight01Icon} />
              </NavigationLink>
            }
          />
        </div>

        <TrustComparison lessonHref={lessonHref} sourceHref={sourceHref} />
      </div>
    </section>
  );
}
