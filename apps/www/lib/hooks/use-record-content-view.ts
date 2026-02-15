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
  locale: Locale;
  delay?: number;
}

/**
 * Records content views with tab visibility tracking.
 * Delays recording until minimum engagement threshold is met.
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
  const clearExpired = useContentViews((s) => s.clearExpired);

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
    clearExpired();
  }, [clearExpired]);

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
