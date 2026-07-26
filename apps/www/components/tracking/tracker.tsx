"use client";

import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/convex/lib/validators/contents";
import type { PropsWithChildren } from "react";
import { useRecordContentView } from "@/lib/hooks/use-record-content-view";

/** Graph content-view tracking inputs for a rendered learning page. */
interface Props {
  contentId?: string | null;
  context?: LearningContextInput;
  delay?: number;
  locale: Locale;
  publicPath: string;
  section: NakafaSection;
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
}: PropsWithChildren<Props>) {
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
