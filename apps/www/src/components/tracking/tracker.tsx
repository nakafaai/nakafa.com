"use client";

import type { LearningContextInput } from "@repo/backend/confect/contents/context";
import type { RecordContentViewArgs } from "@repo/backend/confect/contents/views/spec";
import type { Locale } from "@repo/backend/confect/lib/validators/contents";
import { createContext, type PropsWithChildren, use } from "react";
import type { Locale as RouteLocale } from "use-intl";
import { SignedInIsland } from "@/components/providers/island";
import { useRecordContentView } from "@/lib/content/views/record";
import { isActiveLocale } from "@/lib/i18n/active";

/** Graph content-view tracking inputs for a rendered learning page. */
interface Props {
  contentId?: string | null | undefined;
  context?: LearningContextInput | undefined;
  delay?: number | undefined;
  enabled?: boolean;
  locale: RouteLocale;
  publicPath: string;
  section: RecordContentViewArgs["section"];
}

/**
 * The view the surrounding tracker records, with the route locale narrowed.
 * Only the recorder reads it, so it never wraps the page.
 */
const ContentViewContext = createContext<
  (Omit<Props, "enabled" | "locale"> & { locale: Locale }) | null
>(null);

/**
 * Records a delayed graph content view when a runtime content identity exists.
 *
 * Rendering remains children-first so route modules can compose one explicit
 * page tree while this tracking seam becomes inert for untracked content. The
 * recorder reads Convex, so it mounts on the page's signed-in island: a
 * visitor's page has no client, and a page without a signed-in session records
 * nothing. The children render either way.
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
    <>
      <ContentViewContext
        value={{ contentId, context, delay, locale, publicPath, section }}
      >
        <SignedInIsland>
          <ContentViewRecorder />
        </SignedInIsland>
      </ContentViewContext>
      {children}
    </>
  );
}

/** Records one view of the page on the page's Convex client. */
function ContentViewRecorder() {
  const view = use(ContentViewContext);
  if (view === null) {
    throw new Error(
      "ContentViewRecorder must be used within ContentViewTracker"
    );
  }
  const { contentId, context, delay, locale, publicPath, section } = view;
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
