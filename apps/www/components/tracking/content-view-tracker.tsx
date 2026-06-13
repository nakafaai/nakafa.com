"use client";

import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { PropsWithChildren } from "react";
import { useRecordContentView } from "@/lib/hooks/use-record-content-view";

interface Props {
  contentId: string;
  delay?: number;
  locale: Locale;
}

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
