"use client";

import {
  useDocumentVisibility,
  useLocalStorage,
  useTimeout,
} from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type {
  ContentViewRef,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { generateNanoId } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { useEffect, useMemo } from "react";
import { useContentViews } from "@/lib/context/use-content-views";

interface UseRecordContentViewOptions {
  contentView: ContentViewRef;
  delay?: number;
  locale: Locale;
}

/**
 * Records unique content views per user/device.
 *
 * Design: Once viewed, always viewed. No view count inflation.
 * Uses tab visibility tracking with minimum engagement threshold.
 *
 * @param delay - Minimum engagement time before recording (default: 3000ms)
 */
export function useRecordContentView({
  contentView,
  locale,
  delay = 3000,
}: UseRecordContentViewOptions) {
  const recordView = useMutation(api.contents.mutations.recordContentView);

  const markAsViewed = useContentViews((s) => s.markAsViewed);
  const isViewed = useContentViews((s) => s.isViewed);

  const documentState = useDocumentVisibility();
  const isVisible = documentState === "visible";

  const [deviceId] = useLocalStorage({
    key: "nakafa-device-id",
    defaultValue: useMemo(() => `${Date.now()}-${generateNanoId(9)}`, []),
  });

  const { start, clear } = useTimeout(
    async () => {
      if (isViewed(contentView.slug)) {
        return;
      }

      try {
        await recordView({
          contentRef: { type: contentView.type, slug: contentView.slug },
          locale,
          deviceId,
        });
        markAsViewed(contentView.slug);
      } catch {
        // View tracking is non-critical
      }
    },
    delay,
    { autoInvoke: false }
  );

  useEffect(() => {
    if (isViewed(contentView.slug)) {
      clear();
      return;
    }

    if (isVisible) {
      start();
    } else {
      clear();
    }

    return () => {
      clear();
    };
  }, [isVisible, isViewed, contentView.slug, start, clear]);
}
