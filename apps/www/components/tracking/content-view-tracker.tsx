"use client";

import type {
  ContentViewRef,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import type { PropsWithChildren } from "react";
import { useRecordContentView } from "@/lib/hooks/use-record-content-view";

interface Props {
  contentView: ContentViewRef;
  locale: Locale;
  delay?: number;
}

export function ContentViewTracker({
  contentView,
  locale,
  children,
  delay = 3000,
}: PropsWithChildren<Props>) {
  useRecordContentView({
    contentType: contentView.type,
    slug: contentView.slug,
    locale,
    delay,
  });

  return children;
}
