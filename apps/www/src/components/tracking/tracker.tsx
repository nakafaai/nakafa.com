"use client";

import type { LearningContextInput } from "@repo/backend/confect/contents/context";
import type { RecordContentViewArgs } from "@repo/backend/confect/contents/views/spec";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import type { PropsWithChildren } from "react";
import type { Locale as RouteLocale } from "use-intl";
import { ConvexIsland } from "@/components/providers/island";
import { useRecordContentView } from "@/lib/content/views/record";
import { isActiveLocale } from "@/lib/i18n/active";

/** Graph content-view tracking inputs for a rendered learning page. */
interface Props {
  contentId?: string | null | undefined;
  context?: LearningContextInput | undefined;
  delay?: number;
  enabled?: boolean;
  locale: RouteLocale;
  publicPath: string;
  section: RecordContentViewArgs["section"];
}

/**
 * Records a delayed graph content view when a runtime content identity exists.
 *
 * Rendering remains children-first so route modules can compose one explicit
 * page tree while this tracking seam becomes inert for untracked content.
 */
export function ContentViewTracker({
  contentId,
  context,
  locale,
  publicPath,
  section,
  children,
  delay = 3000,
  enabled = true,
}: PropsWithChildren<Props>) {
  if (!(enabled && isActiveLocale(locale))) {
    return children;
  }

  return (
    <ActiveContentViewTracker
      contentId={contentId}
      context={context}
      delay={delay}
      locale={locale}
      publicPath={publicPath}
      section={section}
    >
      {children}
    </ActiveContentViewTracker>
  );
}

/**
 * Keeps the locale narrowed for the recorder. The recorder reads Convex, so it
 * mounts on the page's island: a visitor's page has no client and records nothing,
 * and the children render either way.
 */
function ActiveContentViewTracker({
  contentId,
  context,
  locale,
  publicPath,
  section,
  children,
  delay,
}: PropsWithChildren<Omit<Props, "locale"> & { locale: Locale }>) {
  return (
    <>
      <ConvexIsland>
        <ContentViewRecorder
          contentId={contentId}
          context={context}
          delay={delay}
          locale={locale}
          publicPath={publicPath}
          section={section}
        />
      </ConvexIsland>
      {children}
    </>
  );
}

/** The inputs that the view recorder reads, with the route locale narrowed. */
interface RecorderProps {
  contentId?: string | null | undefined;
  context?: LearningContextInput | undefined;
  delay?: number | undefined;
  locale: Locale;
  publicPath: string;
  section: RecordContentViewArgs["section"];
}

/** Records one view of the page on the page's Convex client. */
function ContentViewRecorder({
  contentId,
  context,
  locale,
  publicPath,
  section,
  delay,
}: RecorderProps) {
  // Keeps hooks unconditional after the route locale has been narrowed.
  useRecordContentView({
    ...(contentId === undefined ? {} : { contentId }),
    ...(context === undefined ? {} : { context }),
    locale,
    ...(delay === undefined ? {} : { delay }),
    publicPath,
    section,
  });

  return null;
}
