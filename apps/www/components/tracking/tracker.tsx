"use client";

import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import type { RecordContentViewArgs } from "@repo/backend/convex/contents/views/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { Locale as RouteLocale } from "next-intl";
import type { PropsWithChildren } from "react";
import { useRecordContentView } from "@/lib/content/views/record";
import { isActiveLocale } from "@/lib/i18n/active";

/** Graph content-view tracking inputs for a rendered learning page. */
interface Props {
  contentId?: string | null;
  context?: LearningContextInput;
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

/** Keeps hooks unconditional after the route locale has been narrowed. */
function ActiveContentViewTracker({
  contentId,
  context,
  locale,
  publicPath,
  section,
  children,
  delay,
}: PropsWithChildren<Omit<Props, "locale"> & { locale: Locale }>) {
  useRecordContentView({
    contentId,
    context,
    locale,
    delay,
    publicPath,
    section,
  });

  return children;
}
