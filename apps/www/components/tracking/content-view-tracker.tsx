"use client";

import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { PropsWithChildren } from "react";
import { useRecordContentView } from "@/lib/hooks/use-record-content-view";

interface Props {
  contentType: "article" | "subject" | "exercise";
  slug: string;
  locale: Locale;
  delay?: number;
}

export function ContentViewTracker({
  contentType,
  slug,
  locale,
  children,
  delay = 3000,
}: PropsWithChildren<Props>) {
  useRecordContentView({
    contentType,
    slug,
    locale,
    delay,
  });

  return children;
}
