"use client";

import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { PropsWithChildren } from "react";
import { useRecordContentView } from "@/lib/hooks/use-record-content-view";

/** Graph content-view tracking inputs for a rendered learning page. */
interface Props {
  contentId: string;
  delay?: number;
  locale: Locale;
}

/** Records a delayed graph content view while rendering children unchanged. */
export function ContentViewTracker({
  contentId,
  locale,
  children,
  delay = 3000,
}: PropsWithChildren<Props>) {
  useRecordContentView({
    contentId,
    locale,
    delay,
  });

  return children;
}
